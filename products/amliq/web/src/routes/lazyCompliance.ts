import { lazy } from 'react'

export const CaseManagement = lazy(() =>
  import('../pages/CaseManagement').then(m => ({ default: m.CaseManagement }))
)
export const CaseDetail = lazy(() =>
  import('../pages/CaseDetail').then(m => ({ default: m.CaseDetail }))
)
export const RiskAssessment = lazy(() =>
  import('../pages/RiskAssessment').then(m => ({ default: m.RiskAssessment }))
)
export const UBOChain = lazy(() =>
  import('../pages/UBOChain').then(m => ({ default: m.UBOChain }))
)
export const EDDWorkflow = lazy(() =>
  import('../pages/EDDWorkflow').then(m => ({ default: m.EDDWorkflow }))
)
export const TransactionMonitoring = lazy(() =>
  import('../pages/TransactionMonitoring').then(m => ({ default: m.TransactionMonitoring }))
)
export const AdverseMedia = lazy(() =>
  import('../pages/AdverseMedia').then(m => ({ default: m.AdverseMedia }))
)
export const PEPScreening = lazy(() =>
  import('../pages/PEPScreening').then(m => ({ default: m.PEPScreening }))
)
export const SARForm = lazy(() =>
  import('../pages/reporting/SARForm').then(m => ({ default: m.SARForm }))
)
export const ComplianceReport = lazy(() =>
  import('../pages/reporting/ComplianceReport').then(m => ({ default: m.ComplianceReport }))
)
export const CryptoScreeningPage = lazy(() => import('../pages/CryptoScreening'))
export const TxnScreeningPage = lazy(() => import('../pages/TxnScreening'))
export const VesselScreening = lazy(() =>
  import('../pages/VesselScreening').then(m => ({ default: m.VesselScreening }))
)
