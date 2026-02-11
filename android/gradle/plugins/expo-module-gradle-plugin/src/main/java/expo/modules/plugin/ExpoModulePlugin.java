package expo.modules.plugin;

import org.gradle.api.Plugin;
import org.gradle.api.Project;

public class ExpoModulePlugin implements Plugin<Project> {
    public void apply(Project project) {
        System.out.println("Applying ExpoModulePlugin shim");
        // Register the 'expoModule' extension to satisfy the DSL
        project.getExtensions().create("expoModule", ExpoModuleExtension.class);
    }

    public static class ExpoModuleExtension {
        public void canBePublished(boolean value) {
            // No-op
        }
    }
}

