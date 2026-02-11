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
        project.afterEvaluate(p -> {
            if (p.getExtensions().findByName("android") != null) {
                LibraryExtension android = (LibraryExtension) p.getExtensions().getByName("android");
                if (android.getCompileSdkVersion() == null) {
                    System.out.println("Injecting compileSdkVersion 34 into " + p.getName());
                    android.compileSdkVersion(34);
                    android.defaultConfig(config -> {
                        config.minSdkVersion(23);
                        config.targetSdkVersion(34);
                    });
                }
            }
        });
    }

    public static class ExpoModuleExtension {
        public void canBePublished(boolean value) {
            // No-op
        }
    }
}

