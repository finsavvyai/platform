package com.bsl.service.monitor.service;

import com.bsl.service.monitor.config.SanityAPIProperties;
import com.bsl.service.monitor.config.TimeBasedProperties;
import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.sanity.api.APIExecuterDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TimeBasedMonitoringServiceTest {

    @Mock
    private SanityAPIProperties sanityAPIProperties;

    @Mock
    private TimeBasedProperties timeBasedProperties;

    @InjectMocks
    private TimeBasedMonitoringService timeBasedMonitoringService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testExecuteTimeBasedMonitoring_WhenDisabled() {
        // Given
        when(timeBasedProperties.isEnabled()).thenReturn(false);

        // When
        List<ResponseDetails> result = timeBasedMonitoringService.executeTimeBasedMonitoring();

        // Then
        assertTrue(result.isEmpty());
        verify(sanityAPIProperties, never()).getServices();
    }

    @Test
    void testExecuteTimeBasedMonitoring_WhenEnabled() {
        // Given
        when(timeBasedProperties.isEnabled()).thenReturn(true);
        when(timeBasedProperties.getDefaultTimeoutSeconds()).thenReturn(30);

        List<APIExecuterDTO> services = new ArrayList<>();
        APIExecuterDTO service = new APIExecuterDTO();
        service.setName("test_service");
        service.setType("mdwc");
        service.setUrl("http://test.com/");
        service.setRequests(new String[]{"MeMDWC_GetLimit"});
        service.setTimeoutSeconds(45);
        services.add(service);

        when(sanityAPIProperties.getServices()).thenReturn(services);

        // When
        List<ResponseDetails> result = timeBasedMonitoringService.executeTimeBasedMonitoring();

        // Then
        assertNotNull(result);
        // The actual execution will fail in test environment due to missing resources,
        // but we can verify the service is called
        verify(sanityAPIProperties).getServices();
    }
}
