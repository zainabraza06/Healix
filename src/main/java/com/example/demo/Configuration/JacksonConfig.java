package com.example.demo.Configuration;

import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.datatype.hibernate6.Hibernate6Module;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

@Configuration
public class JacksonConfig {

        @Bean
    public Module hibernateModule() {
        Hibernate6Module module = new Hibernate6Module();
        // Disable forced lazy loading
        module.configure(Hibernate6Module.Feature.FORCE_LAZY_LOADING, false);
        // Enable serialization of identifier for lazy not loaded objects
        module.configure(Hibernate6Module.Feature.SERIALIZE_IDENTIFIER_FOR_LAZY_NOT_LOADED_OBJECTS, true);
        return module;
    }
    
    @Bean
    public Jackson2ObjectMapperBuilder jacksonBuilder() {
        return new Jackson2ObjectMapperBuilder()
                .failOnEmptyBeans(false)
                .modulesToInstall(hibernateModule());
    }
}
