// Rabbit R1 Integration with SDLC Compliance Layer
// Example: Using Rabbit R1 for customer service tasks with HIPAA compliance

const LAMIntegrationService = require('../web-app/services/lam-integration');

// Initialize SDLC for Rabbit R1
const sdlc = new LAMIntegrationService({
  environment: 'production',
  complianceFrameworks: ['HIPAA', 'SOC2'],
  auditRetention: '7_years'
});

/**
 * Example 1: Register Rabbit R1 for Healthcare Customer Service
 */
async function registerRabbitR1Healthcare() {
  const rabbitConfig = {
    provider: 'Rabbit',
    model: 'R1',
    capabilities: [
      'web_navigation',
      'form_filling',
      'data_extraction',
      'api_integration'
    ],
    securityProfile: {
      maxSessionTime: 1800, // 30 minutes
      allowedActions: ['read', 'fill', 'navigate', 'extract'],
      blockedActions: ['delete', 'admin_access', 'export_data'],
      allowedDomains: [
        'ehr.healthcompany.com',
        'support.healthcompany.com',
        'api.healthcompany.com/patient/*'
      ],
      blockedDomains: [
        'admin.*',
        'billing.*',
        'system.*'
      ],
      dataAccess: 'phi_read_only',
      requiresSupervision: true,
      screenRecording: true,
      auditLevel: 'comprehensive'
    }
  };

  try {
    const result = await sdlc.registerLAMModel(rabbitConfig);
    console.log('✅ Rabbit R1 registered for healthcare:', result);
    return result.modelId;
  } catch (error) {
    console.error('❌ Failed to register Rabbit R1:', error.message);
    throw error;
  }
}

/**
 * Example 2: Customer Service - Schedule Appointment
 * Rabbit R1 helps a customer service rep schedule a patient appointment
 */
async function schedulePatientAppointment() {
  const appointmentAction = {
    type: 'form_fill',
    target: 'ehr.healthcompany.com/appointments/new',
    data: {
      patientName: 'Sarah Johnson',
      patientEmail: 'sarah.johnson@email.com',
      patientPhone: '(555) 123-4567',
      patientSSN: '123-45-6789',
      appointmentDate: '2024-12-15',
      appointmentTime: '14:30',
      doctor: 'Dr. Michael Chen',
      department: 'Cardiology',
      reason: 'Follow-up visit'
    }
  };

  const context = {
    userId: 'rep_001',
    sessionId: 'session_abc123',
    lamModelId: 'rabbit_r1',
    userAgent: 'Rabbit R1 OS v1.0',
    ipAddress: '192.168.1.100',
    department: 'customer_service',
    supervisorId: 'supervisor_001'
  };

  try {
    const result = await sdlc.interceptLAMAction(appointmentAction, context);

    if (result.success) {
      console.log('✅ Appointment scheduled successfully');
      console.log('📋 Appointment ID:', result.result.data.appointmentId);
      console.log('🛡️ PII Redacted:', result.piiRedacted);
      console.log('⏱️ Processing Time:', result.processingTime, 'ms');
      console.log('📝 Audit ID:', result.auditId);
    } else {
      console.log('❌ Appointment scheduling failed:', result.reason);
      if (result.requiresHumanIntervention) {
        console.log('👥 Human supervisor review required');
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Error scheduling appointment:', error.message);
    throw error;
  }
}

/**
 * Example 3: Customer Service - Check Patient Insurance
 * Rabbit R1 retrieves insurance information while maintaining compliance
 */
async function checkPatientInsurance() {
  const insuranceAction = {
    type: 'api_call',
    endpoint: 'https://api.healthcompany.com/insurance/verify',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer token_xyz123',
      'Content-Type': 'application/json'
    },
    params: {
      patientId: 'PAT-2024-001234',
      policyNumber: 'POL-555-777-999'
    }
  };

  const context = {
    userId: 'rep_001',
    sessionId: 'session_abc123',
    lamModelId: 'rabbit_r1',
    userAgent: 'Rabbit R1 OS v1.0',
    ipAddress: '192.168.1.100',
    purpose: 'insurance_verification',
    consentObtained: true
  };

  try {
    const result = await sdlc.interceptLAMAction(insuranceAction, context);

    if (result.success) {
      console.log('✅ Insurance verification completed');
      console.log('📋 Coverage Status:', result.result.data.coverage);
      console.log('💰 Co-pay Amount:', result.result.data.copay);
      console.log('🏥 Network Status:', result.result.data.inNetwork);
    } else {
      console.log('❌ Insurance verification failed:', result.reason);
    }

    return result;
  } catch (error) {
    console.error('❌ Error checking insurance:', error.message);
    throw error;
  }
}

/**
 * Example 4: Blocked Action - Attempting to Access Admin Panel
 * Demonstrates how SDLC blocks unauthorized actions
 */
async function attemptAdminAccess() {
  const adminAction = {
    type: 'navigate',
    target: 'https://admin.healthcompany.com/system/users',
    data: {
      purpose: 'user_management'
    }
  };

  const context = {
    userId: 'rep_001',
    sessionId: 'session_abc123',
    lamModelId: 'rabbit_r1',
    userAgent: 'Rabbit R1 OS v1.0',
    ipAddress: '192.168.1.100'
  };

  try {
    const result = await sdlc.interceptLAMAction(adminAction, context);

    if (result.blocked) {
      console.log('🛡️ Admin access blocked by SDLC');
      console.log('❌ Reason:', result.reason);
      console.log('👥 Human intervention required:', result.requiresHumanIntervention);
      console.log('📝 Audit ID:', result.auditId);
    }

    return result;
  } catch (error) {
    console.error('❌ Error during admin access attempt:', error.message);
    throw error;
  }
}

/**
 * Example 5: Risk Assessment - High-Risk Action Requiring Approval
 * Rabbit R1 attempts to modify patient records
 */
async function modifyPatientRecords() {
  const modifyAction = {
    type: 'write',
    target: 'ehr.healthcompany.com/patients/PAT-2024-001234/edit',
    data: {
      allergies: ['Penicillin', 'Sulfa drugs'],
      medications: [
        { name: 'Lisinopril', dosage: '10mg', frequency: 'daily' },
        { name: 'Metformin', dosage: '500mg', frequency: 'twice daily' }
      ],
      emergencyContact: {
        name: 'John Johnson',
        phone: '(555) 987-6543',
        relationship: 'husband'
      }
    }
  };

  const context = {
    userId: 'rep_001',
    sessionId: 'session_abc123',
    lamModelId: 'rabbit_r1',
    userAgent: 'Rabbit R1 OS v1.0',
    ipAddress: '192.168.1.100',
    department: 'customer_service'
  };

  try {
    const result = await sdlc.interceptLAMAction(modifyAction, context);

    if (result.blocked) {
      console.log('🛡️ Patient record modification blocked');
      console.log('❌ Reason:', result.reason);
      console.log('⚠️ Risk Level: High - Requires supervisor approval');
      console.log('👥 Escalation: Supervisor notified for review');
    }

    return result;
  } catch (error) {
    console.error('❌ Error during record modification attempt:', error.message);
    throw error;
  }
}

/**
 * Example 6: Compliance Report Generation
 * Generate compliance report for LAM activities
 */
async function generateComplianceReport(userId, dateRange) {
  const report = {
    userId,
    dateRange,
    modelType: 'LAM',
    modelProvider: 'Rabbit',
    summary: {
      totalActions: 0,
      blockedActions: 0,
      piiRedactions: 0,
      highRiskActions: 0,
      averageProcessingTime: 0
    },
    details: []
  };

  // This would query your audit logs
  console.log('📊 Generating compliance report for:', userId);
  console.log('📅 Date range:', dateRange);

  // Example report structure
  const sampleReport = {
    ...report,
    summary: {
      totalActions: 45,
      blockedActions: 3,
      piiRedactions: 12,
      highRiskActions: 2,
      averageProcessingTime: 234
    },
    complianceScore: 97.5,
    auditStatus: 'compliant',
    lastAudit: '2024-11-01T10:00:00Z'
  };

  console.log('✅ Compliance report generated');
  console.log('📊 Summary:', sampleReport.summary);
  console.log('🎯 Compliance Score:', sampleReport.complianceScore + '%');

  return sampleReport;
}

/**
 * Main execution - Run all examples
 */
async function runRabbitR1Examples() {
  console.log('🚀 Starting Rabbit R1 + SDLC Integration Examples\n');

  try {
    // Register Rabbit R1
    console.log('1️⃣ Registering Rabbit R1 for healthcare use...');
    const modelId = await registerRabbitR1Healthcare();
    console.log('');

    // Schedule appointment (should succeed with PII redaction)
    console.log('2️⃣ Scheduling patient appointment...');
    await schedulePatientAppointment();
    console.log('');

    // Check insurance (should succeed)
    console.log('3️⃣ Checking patient insurance...');
    await checkPatientInsurance();
    console.log('');

    // Attempt admin access (should be blocked)
    console.log('4️⃣ Attempting admin access (should be blocked)...');
    await attemptAdminAccess();
    console.log('');

    // Try to modify records (should be blocked/high-risk)
    console.log('5️⃣ Attempting patient record modification (should be blocked)...');
    await modifyPatientRecords();
    console.log('');

    // Generate compliance report
    console.log('6️⃣ Generating compliance report...');
    await generateComplianceReport('rep_001', {
      start: '2024-11-01',
      end: '2024-11-07'
    });
    console.log('');

    console.log('✅ All Rabbit R1 integration examples completed successfully!');

  } catch (error) {
    console.error('❌ Error in examples:', error.message);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runRabbitR1Examples();
}

// Export functions for use in other modules
module.exports = {
  registerRabbitR1Healthcare,
  schedulePatientAppointment,
  checkPatientInsurance,
  attemptAdminAccess,
  modifyPatientRecords,
  generateComplianceReport,
  runRabbitR1Examples
};