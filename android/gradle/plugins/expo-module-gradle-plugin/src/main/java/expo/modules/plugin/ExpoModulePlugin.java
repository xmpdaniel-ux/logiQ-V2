package expo.modules.plugin;

import org.gradle.api.Plugin;
import org.gradle.api.Project;

public class ExpoModulePlugin implements Plugin<Project> {
    public void apply(Project project) {
        // Shim plugin: does nothing but satisfies the requirement
        System.out.println("Applying ExpoModulePlugin shim");
    }
}
