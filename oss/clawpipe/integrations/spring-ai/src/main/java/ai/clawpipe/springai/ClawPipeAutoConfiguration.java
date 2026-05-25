package ai.clawpipe.springai;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/**
 * Spring Boot auto-configuration for the ClawPipe integration.
 *
 * <p>Activates only when {@code clawpipe.api-key} is set in the application
 * environment (property file, env var, etc.). A {@link ClawPipeChatModel} bean
 * is registered and ready for injection without further setup.
 *
 * <p>Add to {@code META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports}
 * so Spring Boot 3.x discovers this class on the classpath.
 */
@AutoConfiguration
@ConditionalOnProperty(prefix = "clawpipe", name = "api-key")
@EnableConfigurationProperties(ClawPipeProperties.class)
public class ClawPipeAutoConfiguration {

    /**
     * Register a {@link ClawPipeChatModel} bean.
     *
     * <p>The {@code @ConditionalOnMissingBean} annotation allows callers to
     * provide their own {@link ClawPipeChatModel} bean (e.g. for testing) and
     * prevents duplicate registration.
     */
    @Bean
    @ConditionalOnMissingBean
    public ClawPipeChatModel clawPipeChatModel(ClawPipeProperties properties) {
        return new ClawPipeChatModel(properties);
    }
}
