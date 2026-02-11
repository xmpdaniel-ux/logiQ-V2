package expo.modules.plugin;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import com.android.build.gradle.LibraryExtension;

public class ExpoModulePlugin implements Plugin<Project> {
    public void apply(Project project) {
        System.out.println("Applying ExpoModulePlugin shim");
        // Register the 'expoModule' extension to satisfy the DSL
        project.getExtensions().create("expoModule", ExpoModuleExtension.class);

        // Inject default Android configuration to satisfy compileSdkVersion requirement
        // We try to configure it immediately if available, or wait for it to be added
        configureAndroidExtension(project);
    }

    private void configureAndroidExtension(Project project) {
        // Try to find the android extension
        Object androidExtension = project.getExtensions().findByName("android");
        if (androidExtension != null && androidExtension instanceof LibraryExtension) {
            applyConfiguration((LibraryExtension) androidExtension, project);
        } else {
            // If not found yet, wait for afterEvaluate
            project.afterEvaluate(p -> {
                Object ext = p.getExtensions().findByName("android");
                if (ext != null && ext instanceof LibraryExtension) {
                    applyConfiguration((LibraryExtension) ext, p);
                }
            });
        }
    }

    private void applyConfiguration(LibraryExtension android, Project project) {
        if (android.getCompileSdkVersion() == null) {
            System.out.println("Shim: Injecting compileSdkVersion 34 into " + project.getName());
            android.compileSdkVersion(34);
            android.defaultConfig(config -> {
                config.minSdkVersion(23);
                config.targetSdkVersion(34);
            });
        } else {
            System.out.println("Shim: " + project.getName() + " already has compileSdkVersion: " + android.getCompileSdkVersion());
        }
    }

    public static class ExpoModuleExtension {
        public void canBePublished(boolean value) {
            // No-op
        }
    }
}

