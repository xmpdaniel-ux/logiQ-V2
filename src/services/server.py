import logging
from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from openai import AsyncOpenAI
import os
import uuid
import asyncio
import hashlib
import re
import json

# Nuevos imports para Google Play
import httpx
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleAuthRequest

# ============== LOGGING SETUP ==============
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ============== APP SETUP ==============
app = FastAPI(title="LogiQ API", version="1.1.3")

api_router = APIRouter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ============== DATABASE ==============
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = "logiq_db"

client: AsyncIOMotorClient = None
db = None

@app.on_event("startup")
async def startup_db_client():
    global client, db
    try:
        client = AsyncIOMotorClient(
            MONGO_URL,
            tlsInsecure=True,
            retryWrites=True,
            serverSelectionTimeoutMS=5000
        )
        db = client[DB_NAME]
        await client.admin.command('ping')
        logging.info(f"✅ Connected to MongoDB: {DB_NAME}")
    except Exception as e:
        logging.error(f"❌ MongoDB connection error: {e}")

# ============== OPENAI CLIENT ==============
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# ============== GOOGLE PLAY CONFIG ==============
GOOGLE_PLAY_INTEGRITY_JSON = os.environ.get('GOOGLE_PLAY_INTEGRITY_JSON')
GOOGLE_PACKAGE_NAME = "com.logiq.app.pro"

credentials = None

if GOOGLE_PLAY_INTEGRITY_JSON:
    try:
        service_account_info = json.loads(GOOGLE_PLAY_INTEGRITY_JSON)
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=["https://www.googleapis.com/auth/androidpublisher"]
        )
        logging.info("✅ Google Play credentials loaded successfully")
    except json.JSONDecodeError:
        logging.critical("❌ GOOGLE_PLAY_INTEGRITY_JSON is not valid JSON")
    except Exception as e:
        logging.critical(f"❌ Failed to load Google Play credentials: {e}")

async def get_google_access_token():
    if not credentials:
        raise HTTPException(status_code=503, detail="Google Play credentials not configured")
    request = GoogleAuthRequest()
    credentials.refresh(request)
    return credentials.token

# ============== PLAY INTEGRITY VALIDATION (DISABLED) ==============
# PLAY_INTEGRITY_DECODE_URL = f"https://androidintegrity.googleapis.com/v1/{GOOGLE_PACKAGE_NAME}:decodeIntegrityToken"

async def validate_play_integrity(integrity_token: str) -> bool:
    if not integrity_token or len(integrity_token.strip()) < 50:
        logging.warning("Integrity token missing or too short")
        return False

    if not credentials:
        logging.error("No Google credentials available for integrity check")
        return False

    try:
        access_token = await get_google_access_token()
        payload = {"integrityToken": integrity_token}

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                PLAY_INTEGRITY_DECODE_URL,
                json=payload,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )

        if resp.status_code != 200:
            logging.warning(f"Play Integrity decode failed: {resp.status_code} {resp.text[:200]}")
            return False

        data = resp.json()
        token_payload = data.get("tokenPayloadExternal", {})

        device_integrity = token_payload.get("deviceIntegrity", {})
        verdict = device_integrity.get("deviceRecognitionVerdict", [])

        if "PLAY_RECOGNIZED" not in verdict:
            logging.warning(f"Device not PLAY_RECOGNIZED → verdict: {verdict}")
            return False

        app_integrity = token_payload.get("appIntegrity", {})
        if app_integrity.get("appRecognitionVerdict") != "PLAY_RECOGNIZED":
            logging.warning("App not recognized by Play")
            return False

        return True

    except Exception as e:
        logging.exception("Play Integrity validation exception")
        return False

# ============== SUSCRIPCIONES GOOGLE PLAY ==============
PLAY_SUBSCRIPTION_GET_URL_TEMPLATE = (
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
    "{packageName}/purchases/subscriptions/{subscriptionId}/tokens/{token}"
)

PRODUCT_DURATIONS = {
    # Primary IDs
    "logiq-monthly-v2": 31,
    "logiq-quarterly-v2": 92,
    "logiq-annual-v2": 366,
    # Underscore variations
    "logiq_monthly_v2": 31,
    "logiq_quarterly_v2": 92,
    "logiq_annual_v2": 366,
    # Premium variations found in Console
    "logiq_premium_monthly": 31,
    "logiq_premium_quarterly": 92,
    "logiq_premium_annual": 366,
    # Legacy / Short variations
    "logiq-monthly": 31,
    "logiq-quarterly": 92,
    "logiq-annual": 366,
}

async def verify_subscription_purchase(purchase_token: str, product_id: str):
    if product_id not in PRODUCT_DURATIONS:
        return False, None, "Invalid product_id"

    if not purchase_token:
        return False, None, "Missing purchase_token"

    existing = await db['users'].find_one({"purchase_token": purchase_token})
    if existing and existing.get("is_premium") and existing.get("premium_expires", datetime.min) > datetime.utcnow():
        return True, existing["premium_expires"], "Already used - still active"

    try:
        access_token = await get_google_access_token()
        url = PLAY_SUBSCRIPTION_GET_URL_TEMPLATE.format(
            packageName=GOOGLE_PACKAGE_NAME,
            subscriptionId=product_id,
            token=purchase_token
        )

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )

        if resp.status_code != 200:
            logging.warning(f"Google Play subscription check failed: {resp.status_code} {resp.text[:180]}")
            return False, None, f"Google rejected token (code {resp.status_code})"

        data = resp.json()

        subscription_state = int(data.get("subscriptionState", 0))
        if subscription_state != 1:
            return False, None, f"Subscription state is {subscription_state} (not active)"

        expiry_ms_str = data.get("expiryTimeMillis", "0")
        try:
            expiry_ms = int(expiry_ms_str)
            expiry_date = datetime.fromtimestamp(expiry_ms / 1000.0)
        except (ValueError, TypeError):
            return False, None, "Invalid expiryTimeMillis format"

        return True, expiry_date, None

    except Exception as e:
        logging.exception("Error verifying Google Play subscription")
        return False, None, str(e)

# ============== HELPER PREMIUM CHECK ==============
async def is_user_premium_active(unique_key: str) -> bool:
    user = await db['users'].find_one({"unique_key": unique_key})
    if not user:
        return False
    if not user.get("is_premium", False):
        return False
    expiry = user.get("premium_expires")
    if not expiry:
        return False
    return expiry > datetime.utcnow()

# ============== MODELS ==============
class UserCreate(BaseModel):
    device_id: str
    hardware_fingerprint: Optional[str] = None

class FDUReportRequest(BaseModel):
    category: str
    p1: float = Field(..., ge=0, le=10)
    p2: float = Field(..., ge=0, le=10)
    u1: float = Field(..., ge=0, le=10)
    u2: float = Field(..., ge=0, le=10)
    c1: float = Field(..., ge=0, le=10)
    c2: float = Field(..., ge=0, le=10)
    r1: float = Field(..., ge=0, le=10)
    r2: float = Field(..., ge=0, le=10)
    score: float
    status: str
    context: str = ""
    device_id: str = ""
    hardware_fingerprint: Optional[str] = None
    language: str = "es"

    class Config:
        extra = "ignore"

class AIFollowupRequest(BaseModel):
    category: str
    question: str
    conversation_history: list = []
    device_id: str = ""
    hardware_fingerprint: Optional[str] = None
    language: str = "es"
    session_id: Optional[str] = None

    class Config:
        extra = "ignore"

class VerifyPurchaseRequest(BaseModel):
    device_id: str
    purchase_token: str
    product_id: str
    hardware_fingerprint: Optional[str] = None

    class Config:
        extra = "ignore"

# ============== DISCLAIMER MULTILINGÜE ==============
def get_disclaimer(lang: str) -> str:
    lang = lang[:2].lower()
    disclaimers = {
        "es": "\n\n⚠️ AVISO: Los informes de LogiQ son sugerencias basadas en IA. No sustituyen asesoramiento profesional.",
        "en": "\n\n⚠️ DISCLAIMER: LogiQ reports are AI-based suggestions. They do not replace professional advice.",
        "pt": "\n\n⚠️ AVISO: Os relatórios do LogiQ são sugestões baseadas em IA. Não substituem aconselhamento profissional.",
        "fr": "\n\n⚠️ AVERTISSEMENT : Les rapports LogiQ sont des suggestions basées sur l'IA. Ils ne remplacent pas un conseil professionnel."
    }
    return disclaimers.get(lang, disclaimers["es"])

# ============== HELPER PARA CALCULAR IDENTIDADES ==============
def get_user_keys(device_id: str, hardware_fingerprint: Optional[str] = None) -> dict:
    unique_key = device_id
    if hardware_fingerprint:
        unique_key = hashlib.sha256((device_id + hardware_fingerprint).encode()).hexdigest()
    
    return {
        "device_id": device_id,
        "unique_key": unique_key,
        "has_fingerprint": hardware_fingerprint is not None
    }

# ============== HELPER FUNCTIONS (CRÉDITOS Y USUARIOS) ==============

async def get_or_create_user(device_id: str, hardware_fingerprint: Optional[str] = None) -> dict:
    try:
        users = db['users']
        keys = get_user_keys(device_id, hardware_fingerprint)
        unique_key = keys['unique_key']
        
        user = await users.find_one({"unique_key": unique_key})
        
        if not user:
            new_user = {
                "id": str(uuid.uuid4()),
                "device_id": device_id,
                "unique_key": unique_key,
                "hardware_fingerprint": hardware_fingerprint,
                "report_credits": 2,
                "chat_credits": 4,
                "is_premium": False,
                "premium_expires": None,
                "credits_granted_at": datetime.utcnow(),
                "created_at": datetime.utcnow()
            }
            await users.insert_one(new_user)
            await db['audit_logs'].insert_one({
                "event": "user_created",
                "unique_key": unique_key,
                "timestamp": datetime.utcnow()
            })
            return new_user
        else:
            if 'credits_granted_at' not in user:
                await users.update_one({"unique_key": unique_key}, {"$set": {"credits_granted_at": datetime.utcnow()}})
        
        return user
    except Exception as e:
        logging.error(f"❌ Error in get_or_create_user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def deduct_report_credit(unique_key: str):
    try:
        await db['users'].update_one(
            {"unique_key": unique_key, "report_credits": {"$gt": 0}, "is_premium": False},
            {"$inc": {"report_credits": -1}}
        )
    except Exception as e:
        logging.error(f"❌ Error deducting report credit: {e}")

async def deduct_chat_credit(unique_key: str):
    try:
        await db['users'].update_one(
            {"unique_key": unique_key, "chat_credits": {"$gt": 0}, "is_premium": False},
            {"$inc": {"chat_credits": -1}}
        )
    except Exception as e:
        logging.error(f"❌ Error deducting chat credit: {e}")

# ============== HELPER PARA CHAT PERSISTENTE ==============
async def save_chat_to_history(device_id: str, question: str, ai_response: str, session_id: Optional[str] = None):
    try:
        if session_id:
            recent_decision = await db['decisions'].find_one({"id": session_id})
        else:
            recent_decision = await db['decisions'].find_one(
                {"device_id": device_id},
                sort=[("created_at", -1)]
            )
        
        if recent_decision:
            chat_entry = {
                "user": question,
                "ai": ai_response,
                "timestamp": datetime.utcnow()
            }
            
            await db['decisions'].update_one(
                {"_id": recent_decision["_id"]},
                {"$push": {"chat_history": chat_entry}},
                upsert=False
            )
            logging.info(f"✅ Chat guardado en decisión {recent_decision.get('id', 'unknown')}")
        else:
            logging.warning(f"⚠️ No se encontró decisión reciente para device_id: {device_id}")
    
    except Exception as e:
        logging.error(f"❌ Error guardando chat en historial: {e}")

# ============== CROSS-CHECK ENGINE (DETECCIÓN DE SESGOS) ==============

def cross_check_biases(request: FDUReportRequest, lang: str) -> str:
    lang = lang.lower()
    checks = []
    
    if request.u1 > 7 and request.u2 > 7 and request.r1 < 4 and request.r2 < 4 and request.c1 < 4 and request.c2 < 4:
        if lang == "es":
            checks.append("Nota: Detectado posible sesgo de optimismo excesivo. El usuario anticipa alto beneficio con bajo riesgo y esfuerzo. Cuestiona si esto es realista, considerando factores externos como competencia de mercado o volatilidad financiera. Sugiere explorar puntos ciegos como '¿Qué pasa si el mercado cambia?'")
        elif lang == "en":
            checks.append("Note: Detected possible excessive optimism bias. The user anticipates high benefit with low risk and effort. Question if this is realistic, considering external factors like market competition or financial volatility. Suggest exploring blind spots like 'What if the market changes?'")
        elif lang == "pt":
            checks.append("Nota: Detectado possível viés de otimismo excessivo. O usuário antecipa alto benefício com baixo risco e esforço. Questione se isso é realista, considerando fatores externos como competição de mercado ou volatilidade financeira. Sugira explorar pontos cegos como 'O que acontece se o mercado mudar?'")
        elif lang == "fr":
            checks.append("Note : Détecté un possible biais d'optimisme excessif. L'utilisateur anticipe un haut bénéfice avec un faible risque et effort. Questionnez si cela est réaliste, en considérant des facteurs externes comme la concurrence du marché ou la volatilité financière. Suggérez d'explorer des angles morts comme 'Que se passe-t-il si le marché change ?'")
    
    if (request.u1 + request.u2) / 2 > 7 and (request.r1 + request.r2) / 2 > 6:
        if lang == "es":
            checks.append("Nota: Disparidad entre beneficio alto y riesgo alto. Analiza si el estrés o pérdidas potenciales justifican la utilidad. Cuestiona sesgos como 'confirmation bias' donde el usuario ignora riesgos.")
        elif lang == "en":
            checks.append("Note: Disparity between high benefit and high risk. Analyze if the stress or potential losses justify the utility. Question biases like 'confirmation bias' where the user ignores risks.")
        elif lang == "pt":
            checks.append("Nota: Disparidade entre alto benefício e alto risco. Analise se o estresse ou perdas potenciais justificam a utilidade. Questione vieses como 'viés de confirmação' onde o usuário ignora riscos.")
        elif lang == "fr":
            checks.append("Note : Disparité entre haut bénéfice et haut risque. Analysez si le stress ou les pertes potentielles justifient l'utilité. Questionnez des biais comme 'biais de confirmation' où l'utilisateur ignore les risques.")
    
    if (request.p1 + request.p2) / 2 < 4 and (request.u1 + request.u2) / 2 > 7:
        if lang == "es":
            checks.append("Nota: Baja probabilidad de éxito pero alta utilidad esperada. Posible ilusión de control. Obliga a evaluar escenarios realistas y planes de contingencia.")
        elif lang == "en":
            checks.append("Note: Low probability of success but high expected utility. Possible illusion of control. Force evaluation of realistic scenarios and contingency plans.")
        elif lang == "pt":
            checks.append("Nota: Baixa probabilidade de sucesso mas alta utilidade esperada. Possível ilusão de controle. Force a avaliação de cenários realistas e planos de contingência.")
        elif lang == "fr":
            checks.append("Note : Faible probabilité de succès mais haute utilité attendue. Possible illusion de contrôle. Forcez l'évaluation de scénarios réalistes et plans de contingence.")
    
    if (request.c1 + request.c2) / 2 > 7 and (request.u1 + request.u2) / 2 < 4:
        if lang == "es":
            checks.append("Nota: Alto esfuerzo requerido pero bajo beneficio. Posible 'falacia de costo hundido' en el futuro. Sugiere reevaluar viabilidad.")
        elif lang == "en":
            checks.append("Note: High effort required but low benefit. Possible 'sunk cost fallacy' in the future. Suggest reevaluating viability.")
        elif lang == "pt":
            checks.append("Nota: Alto esforço requerido mas baixo benefício. Possível 'falácia do custo afundado' no futuro. Sugira reavaliar viabilidade.")
        elif lang == "fr":
            checks.append("Note : Haut effort requis mais faible bénéfice. Possible 'erreur des coûts irrécupérables' dans le futur. Suggérez de réévaluer la viabilité.")
    
    if (request.p1 + request.p2) / 2 > 7 and (request.r1 + request.r2) / 2 > 7:
        if lang == "es":
            checks.append("Nota: Alta probabilidad percibida con alto riesgo. Posible 'exceso de confianza'. Revisa si estás sobreestimando tus capacidades o subestimando amenazas externas.")
        elif lang == "en":
            checks.append("Note: High perceived probability with high risk. Possible 'overconfidence'. Review if you are overestimating your capabilities or underestimating external threats.")
        elif lang == "pt":
            checks.append("Nota: Alta probabilidade percebida com alto risco. Possível 'excesso de confiança'. Revise se você está superestimando suas capacidades ou subestimando ameaças externas.")
        elif lang == "fr":
            checks.append("Note : Haute probabilité perçue avec haut risque. Possible 'excès de confiance'. Vérifiez si vous surestimez vos capacités ou sous-estimez les menaces externes.")
    
    return "\n".join(checks) if checks else {
        "es": "No se detectaron sesgos significativos, pero siempre valida contra contexto real.",
        "en": "No significant biases detected, but always validate against real context.",
        "pt": "Nenhum viés significativo detectado, mas sempre valide contra o contexto real.",
        "fr": "Aucun biais significatif détecté, mais validez toujours contre le contexte réel."
    }.get(lang, "No se detectaron sesgos significativos, pero siempre valida contra contexto real.")

# ============== AUTO-SAVE HELPER ==============
async def auto_save_decision(device_id: str, category: str, inputs: dict, result: dict, context: str, ai_report: str):
    try:
        decision = {
            "id": str(uuid.uuid4()),
            "device_id": device_id,
            "category": category,
            "inputs": inputs,
            "result": result,
            "context": context,
            "ai_report": ai_report,
            "chat_history": [],
            "created_at": datetime.utcnow()
        }
        await db['decisions'].insert_one(decision)
        logging.info(f"✅ Reporte guardado automáticamente para device_id: {device_id}")
    except Exception as e:
        logging.error(f"❌ Error al guardar reporte automáticamente: {e}")

# ============== USER ENDPOINTS ==============

@api_router.post("/user/register")
async def register_user(user_data: UserCreate):
    try:
        user = await get_or_create_user(user_data.device_id, user_data.hardware_fingerprint)
        return {
            "success": True,
            "report_credits": user.get('report_credits', 2),
            "chat_credits": user.get('chat_credits', 4),
            "is_premium": user.get('is_premium', False)
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"❌ Error in register_user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/user/credits/{device_id}")
async def get_user_credits(device_id: str):
    try:
        user = await db['users'].find_one({"device_id": device_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        is_premium = user.get('is_premium', False)
        report_credits = user.get('report_credits', 0)
        chat_credits = user.get('chat_credits', 0)
        
        return {
            "report_credits": report_credits,
            "chat_credits": chat_credits,
            "is_premium": is_premium,
            "has_report_credits": is_premium or report_credits > 0,
            "has_chat_credits": is_premium or chat_credits > 0
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"❌ Error in get_user_credits: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# ============== SECCIÓN CORREGIDA PARA BORRADO SEGURO ==============

@api_router.get("/user/purge/{device_id}")
@api_router.post("/user/purge/{device_id}")
async def purge_user_data(device_id: str):
    clean_device_id = device_id.strip()
    
    logging.info(f"🚀 [BORRADO SOLICITADO]: Iniciando limpieza para {clean_device_id}")
    
    try:
        user_result = await db['users'].delete_many({"device_id": clean_device_id})
        decisions_result = await db['decisions'].delete_many({"device_id": clean_device_id})
        
        logging.info(f"📊 [RESULTADO]: Usuarios: {user_result.deleted_count}, Decisiones: {decisions_result.deleted_count}")
        
        return {
            "success": True,
            "message": "Limpieza profunda completada",
            "details": {
                "usuarios_eliminados": user_result.deleted_count,
                "reportes_eliminados": decisions_result.deleted_count
            }
        }
    
    except Exception as e:
        logging.error(f"❌ Error en el borrado: {e}")
        raise HTTPException(status_code=500, detail="Error interno al intentar borrar datos")

# ============== AI ENDPOINTS ==============

@api_router.post("/generate-ai-report")
async def generate_ai_report(request: FDUReportRequest, background_tasks: BackgroundTasks):
    # Integrity check disabled for Build 117 (Plan 0)
    # if not await validate_play_integrity(request.integrity_token):
    #     raise HTTPException(status_code=403, detail="Device integrity verification failed")

    user = await get_or_create_user(request.device_id, request.hardware_fingerprint)
    unique_key = user['unique_key']

    is_premium = await is_user_premium_active(unique_key)

    if not is_premium:
        if user.get('report_credits', 0) <= 0:
            raise HTTPException(status_code=402, detail="Payment required - no credits and not premium")

    try:
        user_lang = request.language[:2].lower() if request.language else "es"

        language_instruction = {
            "es": "Responde EXCLUSIVAMENTE en Español. Todo el contenido debe estar en español.",
            "en": "Respond EXCLUSIVELY in English. All content must be in English.",
            "pt": "Responda EXCLUSIVAMENTE em Português. Todo o conteúdo debe estar em português.",
            "fr": "Répondez EXCLUSIVEMENT en Français. Tout le contenu doit être en français."
        }.get(user_lang, "Responde EXCLUSIVAMENTE en Español. Todo el contenido debe estar en español.")

        titles_map = {
            "es": {
                "insight": "Insight Ejecutivo",
                "diagnosis": "Diagnóstico",
                "blind_spots": "Puntos Ciegos",
                "roadmap": "Hoja de Ruta"
            },
            "en": {
                "insight": "Executive Insight",
                "diagnosis": "Diagnosis",
                "blind_spots": "Blind Spots",
                "roadmap": "Roadmap"
            },
            "pt": {
                "insight": "Insight Executivo",
                "diagnosis": "Diagnóstico",
                "blind_spots": "Pontos Cegos",
                "roadmap": "Roteiro"
            },
            "fr": {
                "insight": "Aperçu Exécutif",
                "diagnosis": "Diagnostic",
                "blind_spots": "Angles Morts",
                "roadmap": "Feuille de Route"
            }
        }
        titles = titles_map.get(user_lang, titles_map["es"])

        system_instruction = f"""
You are a Senior Consultant at LogiQ, a consortium of experts: Engineer (technical logic), Psychologist (bias detection), Financier (viability).

Mission: Validate the real feasibility of the decision against the provided context, analyzing the 8 FDU variables (p1/p2: Probability; u1/u2: Utility/Benefit; c1/c2: Cost/Effort; r1/r2: Risk) to identify blind spots.

Contradiction Detection: Analyze disparities between benefits (u1/u2) vs risks (r1/r2) and other biases. Actively question the user about inconsistencies to eliminate cognitive biases.

Output: Structure the response with the following sections:
- {titles['diagnosis']}: Summary of viability based on data and context.
- {titles['blind_spots']}: List of hidden risks, detected biases, and questions for the user.
- {titles['roadmap']}: Actionable steps to mitigate risks and maximize benefits.

Tone: Empathetic but direct, like an expert mentor. Avoid generic responses; personalize to the context.
{language_instruction}
"""

        bias_check = cross_check_biases(request, user_lang)

        prompt = f"""
Category: {request.category}.
FDU Data: p1={request.p1}, p2={request.p2}, u1={request.u1}, u2={request.u2}, c1={request.c1}, c2={request.c2}, r1={request.r1}, r2={request.r2}.
Final Score: {request.score:.1f}/100.
Context: "{request.context}"

{bias_check}

Instructions: Analyze whether the numbers align with the context. Do not mention codes like 'p1'; refer to concepts (e.g., 'probability of success'). Speak as the consortium of experts. 
Interpret and incorporate the bias checks into the report sections in the output language. Translate the 'Note/Nota' from the bias check if it's in another language.
"""

        try:
            response = await asyncio.wait_for(
                openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7
                ),
                timeout=25.0
            )
            ai_text = response.choices[0].message.content
        except asyncio.TimeoutError:
            logging.warning("⚠️ OpenAI timeout occurred")
            return {"success": False, "error": "timeout", "message": "La IA está tardando. Reintenta."}
        except Exception as openai_err:
            logging.error(f"❌ OpenAI error: {openai_err}")
            raise HTTPException(status_code=500, detail="Error en la generación de IA")

        disclaimer = get_disclaimer(user_lang)
        full_report = ai_text + disclaimer

        inputs = {
            "p1": request.p1, "p2": request.p2,
            "u1": request.u1, "u2": request.u2,
            "c1": request.c1, "c2": request.c2,
            "r1": request.r1, "r2": request.r2
        }
        result = {"score": request.score, "status": request.status}

        background_tasks.add_task(
            auto_save_decision,
            request.device_id,
            request.category,
            inputs,
            result,
            request.context,
            full_report
        )

        if not is_premium:
            await deduct_report_credit(unique_key)

        category_display = request.category.replace("_", " ").title()
        copy_ready_text = f"""# Reporte LogiQ - {category_display}

{ai_text}

---
{disclaimer.strip()}"""
        
        return {
            "success": True,
            "report": full_report,
            "copy_ready": copy_ready_text
        }

    except HTTPException as he: 
        raise he
    except Exception as e:
        logging.error(f"❌ Error in generate_ai_report: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@api_router.post("/ai-followup")
async def ai_followup(request: AIFollowupRequest, background_tasks: BackgroundTasks):
    # Integrity check disabled for Build 117 (Plan 0)
    # if not await validate_play_integrity(request.integrity_token):
    #     raise HTTPException(status_code=403, detail="Device integrity verification failed")

    user = await get_or_create_user(request.device_id, request.hardware_fingerprint)
    unique_key = user['unique_key']

    is_premium = await is_user_premium_active(unique_key)

    if not is_premium:
        if user.get('chat_credits', 0) <= 0:
            raise HTTPException(status_code=402, detail="Payment required - no credits and not premium")

    try:
        user_lang = request.language[:2].lower() if request.language else "es"

        language_instruction = {
            "es": "Responde EXCLUSIVAMENTE en Español.",
            "en": "Respond EXCLUSIVELY in English.",
            "pt": "Responda EXCLUSIVAMENTE em Português.",
            "fr": "Répondez EXCLUSIVEMENT en Français."
        }.get(user_lang, "Responde EXCLUSIVAMENTE en Español.")

        system_instruction = f"""
You are a Senior Consultant at LogiQ, a consortium of experts in Business, Psychology, and Finance.
Provide brief, empathetic responses focused on eliminating biases and offering clear insights.
{language_instruction}
"""

        messages = [{"role": "system", "content": system_instruction}]
        for msg in request.conversation_history[-4:]:
            messages.append({"role": msg.get('role', 'user'), "content": msg.get('content', '')})
        messages.append({"role": "user", "content": request.question})

        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=500
        )
        
        if not is_premium:
            await deduct_chat_credit(unique_key)
        
        ai_response_text = response.choices[0].message.content
        disclaimer = get_disclaimer(user_lang)
        
        background_tasks.add_task(
            save_chat_to_history,
            request.device_id,
            request.question,
            ai_response_text,
            request.session_id
        )
        
        return {"success": True, "response": ai_response_text + disclaimer}
    
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"❌ Error en followup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== HISTORIAL - GUARDADO Y OBTENCIÓN ==============

@api_router.post("/decisions/save")
async def save_decision(request: FDUReportRequest):
    # Integrity check disabled for Build 117
    # if not await validate_play_integrity(request.integrity_token):
    #     raise HTTPException(status_code=403, detail="Integrity check failed")
   
    decision_data = {
        "device_id": request.device_id,
        "category": request.category,
        "inputs": {
            "p1": request.p1, "p2": request.p2,
            "u1": request.u1, "u2": request.u2,
            "c1": request.c1, "c2": request.c2,
            "r1": request.r1, "r2": request.r2
        },
        "result": {"score": request.score, "status": request.status},
        "context": request.context,
        "updated_at": datetime.utcnow()
    }
   
    cinco_minutos_atras = datetime.utcnow() - timedelta(minutes=5)
   
    result = await db['decisions'].update_one(
        {
            "device_id": request.device_id,
            "category": request.category,
            "created_at": {"$gte": cinco_minutos_atras}
        },
        {"$set": decision_data},
        upsert=True
    )
    return {"success": True, "action": "updated" if result.matched_count > 0 else "created"}

@api_router.get("/decisions/{device_id}")
async def get_decisions(device_id: str, hardware_fingerprint: Optional[str] = None):
    clean_device_id = device_id.strip()
    logging.info(f"🔍 DEBUG - [get_decisions]: Recibiendo device_id={clean_device_id}")
    
    try:
        decisions_filter = {"device_id": clean_device_id}
        decisions = await db['decisions'].find(decisions_filter).sort("created_at", -1).to_list(50)
        
        logging.info(f"✅ DEBUG - [get_decisions]: Encontradas {len(decisions)} decisiones")
        
        for d in decisions: 
            d['_id'] = str(d['_id'])
            if 'chat_history' not in d:
                d['chat_history'] = []
        
        return {"success": True, "decisions": decisions}
    except Exception as e:
        logging.error(f"❌ Error obteniendo decisiones: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== ENDPOINT DE BORRADO INDIVIDUAL CORREGIDO ==============

@api_router.get("/decisions/delete/{decision_id}")
@api_router.delete("/decisions/delete/{decision_id}")
async def delete_decision(decision_id: str):
    clean_id = decision_id.strip()
    
    logging.info(f"🚀 [DELETE INDIVIDUAL]: Intentando borrar ID: {clean_id}")
    
    try:
        result = await db['decisions'].delete_one({"id": clean_id})
        
        if result.deleted_count > 0:
            logging.info(f"✅ [DELETE] Éxito: Decisión {clean_id} eliminada")
            return {
                "success": True, 
                "message": "Eliminado correctamente",
                "deleted_count": result.deleted_count
            }
        else:
            from bson import ObjectId
            try:
                result_oid = await db['decisions'].delete_one({"_id": ObjectId(clean_id)})
                if result_oid.deleted_count > 0:
                    return {"success": True, "message": "Eliminado por ObjectId", "deleted_count": 1}
            except:
                pass
                
            logging.warning(f"⚠️ [DELETE] No se encontró nada con el ID: {clean_id}")
            return {
                "success": False, 
                "message": "No se encontró el registro",
                "deleted_count": 0
            }
            
    except Exception as e:
        logging.error(f"❌ Error en delete_decision: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== ENDPOINT DE DEBUG ==============

@api_router.get("/decisions/debug/{device_id}")
async def debug_decisions(device_id: str):
    clean_device_id = device_id.strip()
    logging.info(f"🔍 [DEBUG] Inspeccionando decisiones para device_id={clean_device_id}")
    
    try:
        decisions = await db['decisions'].find({"device_id": clean_device_id}).to_list(100)
        
        debug_info = []
        for d in decisions:
            debug_info.append({
                "id": d.get("id"),
                "_id": str(d.get("_id")),
                "category": d.get("category"),
                "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
                "has_chat_history": len(d.get("chat_history", [])) > 0,
                "chat_count": len(d.get("chat_history", []))
            })
        
        logging.info(f"✅ [DEBUG] Encontradas {len(debug_info)} decisiones")
        
        return {
            "success": True,
            "device_id": clean_device_id,
            "total_decisions": len(debug_info),
            "decisions": debug_info
        }
    
    except Exception as e:
        logging.error(f"❌ [DEBUG] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== NUEVO ENDPOINT /verify-purchase ==============
@api_router.post("/verify-purchase")
async def verify_purchase(data: VerifyPurchaseRequest):
    # Integrity check disabled for Build 118
    # if not await validate_play_integrity(data.integrity_token):
    #     raise HTTPException(status_code=403, detail="Device integrity check failed")

    is_active, expiry_date, error = await verify_subscription_purchase(
        data.purchase_token, data.product_id
    )

    if not is_active:
        raise HTTPException(status_code=402, detail=f"Invalid subscription: {error}")

    # CORRECCIÓN: pasar hardware_fingerprint para que la unique_key coincida
    user = await get_or_create_user(data.device_id, data.hardware_fingerprint)
    unique_key = user["unique_key"]

    await db['users'].update_one(
        {"unique_key": unique_key},
        {
            "$set": {
                "is_premium": True,
                "premium_expires": expiry_date,
                "purchase_token": data.purchase_token,
                "product_id": data.product_id,
                "last_subscription_verify": datetime.utcnow()
            }
        },
        upsert=False
    )

    return {
        "success": True,
        "message": "Subscription activated / renewed",
        "expiry_date": expiry_date.isoformat(),
        "product": data.product_id
    }

# ============== INCLUIR ROUTER Y ARRANCAR ==============

app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))