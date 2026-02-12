package expo.modules.plugin;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import com.android.build.gradle.LibraryExtension;

public class ExpoModulePlugin implements Plugin<Project> {
    public void apply(Project project) {
        project.getExtensions().create("expoModule", ExpoModuleExtension.class);

        // Ensure Kotlin is applied because Expo modules are Kotlin-based
        // Most modules rely on expo-module-gradle-plugin to apply kotlin-android
        if (!project.getPlugins().hasPlugin("org.jetbrains.kotlin.android")) {
            System.out.println("Shim: Applying kotlin-android to " + project.getName());
            project.getPluginManager().apply("org.jetbrains.kotlin.android");
        }

        // Inject default Android configuration to satisfy compileSdkVersion requirement
        // We try to configure it immediately if available, or wait for it to be added
        configureAndroidExtension(project);
    }

    private void configureAndroidExtension(Project project) {
        // Attempt immediate configuration
        if (project.getExtensions().findByName("android") != null) {
            applyAndroidConfig(project);
        }

        // Also register a listener in case the android plugin is applied later
        project.getPlugins().withId("com.android.library", plugin -> {
             applyAndroidConfig(project);
        });
    }

    private void applyAndroidConfig(Project project) {
         try {
             LibraryExtension android = (LibraryExtension) project.getExtensions().findByName("android");
             if (android != null && android.getCompileSdkVersion() == null) {
                 System.out.println("Shim: Injecting compileSdkVersion 34 into " + project.getName());
                 android.compileSdkVersion(34);
                 android.defaultConfig(config -> {
                     config.minSdkVersion(23);
                     config.targetSdkVersion(34);
                 });
             }
         } catch (Exception e) {
             System.out.println("Shim: Skipping SDK injection for " + project.getName() + " due to casting issue: " + e.getMessage());
         }
    }

    // This class satisfies the DSL requirements for "expoModule { ... }"
    public static class ExpoModuleExtension {
        public void canBePublished(boolean value) {}
        public void name(String value) {}
        public void version(String value) {}
    }
}
