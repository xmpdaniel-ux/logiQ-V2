package expo.modules.plugin;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import com.android.build.gradle.LibraryExtension;

public class ExpoModulePlugin implements Plugin<Project> {
    public void apply(Project project) {
        project.getExtensions().create("expoModule", ExpoModuleExtension.class);

        // 1. Ensure Kotlin is applied
        if (!project.getPlugins().hasPlugin("org.jetbrains.kotlin.android")) {
            System.out.println("Shim: Applying kotlin-android to " + project.getName());
            project.getPluginManager().apply("org.jetbrains.kotlin.android");
        }

        // 2. Add expo-modules-core dependency (CRITICAL for Module, ModuleDefinition symbols)
        if (!project.getName().equals("expo-modules-core")) {
            System.out.println("Shim: Adding expo-modules-core dependency to " + project.getName());
            project.getDependencies().add("implementation", project.getRootProject().findProject(":expo-modules-core"));
             // Also add kotlin-stdlib explicitly to be safe, though kotlin-android usually handles it.
             // But expo-modules-core should bring it transitively.
        }

        // 3. Inject configuration
        configureAndroidExtension(project);
    }

    private void configureAndroidExtension(Project project) {
        if (project.getExtensions().findByName("android") != null) {
            applyAndroidConfig(project);
        }
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

    public static class ExpoModuleExtension {
        public void canBePublished(boolean value) {}
        public void name(String value) {}
        public void version(String value) {}
    }
}
