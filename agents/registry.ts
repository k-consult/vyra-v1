import { run as runControlIntelligence } from './agents/control-intelligence';
import { run as runSignalIntelligence } from './agents/signal-intelligence';
import { run as runRiskIntelligence } from './agents/risk-intelligence';
import { run as runAssuranceIntelligence } from './agents/assurance';

export const agents: Record<string, (arg?: string) => Promise<void>> = {
    'control-intelligence': runControlIntelligence,
    'signal-intelligence': runSignalIntelligence,
    'risk-intelligence': runRiskIntelligence,
    'assurance-intelligence': runAssuranceIntelligence,
};
