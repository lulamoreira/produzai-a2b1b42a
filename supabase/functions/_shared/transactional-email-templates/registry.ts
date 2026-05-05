/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as occurrenceNotification } from './occurrence-notification.tsx'
import { template as occurrenceTracking } from './occurrence-tracking.tsx'
import { template as supplierInvite } from './supplier-invite.tsx'
import { template as budgetResultsToClient } from './budget-results-to-client.tsx'
import { template as supplierWinnerNotification } from './supplier-winner-notification.tsx'
import { template as negotiationProposalToSupplier } from './negotiation-proposal-to-supplier.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'occurrence-notification': occurrenceNotification,
  'occurrence-tracking': occurrenceTracking,
  'supplier-invite': supplierInvite,
  'budget-results-to-client': budgetResultsToClient,
  'supplier-winner-notification': supplierWinnerNotification,
  'negotiation-proposal-to-supplier': negotiationProposalToSupplier,
}
