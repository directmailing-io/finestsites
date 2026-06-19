export type Plan = 'starter' | 'pro' | 'unlimited'
export type BillingInterval = 'monthly' | 'yearly'
export type SiteStatus = 'draft' | 'published' | 'deactivated' | 'deleted'
export type TemplateStatus = 'draft' | 'published'
export type PlaceholderType = 'text' | 'textarea' | 'richtext' | 'image' | 'url' | 'email' | 'select' | 'dropdown' | 'card_select' | 'loop' | 'color' | 'date' | 'time' | 'toggle' | 'date_multi' | 'range'

export interface LoopSubField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'richtext' | 'image' | 'url' | 'email' | 'dropdown' | 'loop' | 'color' | 'date' | 'time' | 'card_select' | 'toggle' | 'date_multi' | 'range'
  required?: boolean
  placeholder_text?: string
  max_length?: number | null
  default_value?: string
  aspect_ratio?: string
  options?: string[]
  card_options?: CardOption[]
  display_mode?: 'chips' | 'toggle'
  // for toggle: which value means "on"
  toggle_on_value?: string
  toggle_off_value?: string
  // visibility condition based on a sibling sub-field's value
  show_when?: { field: string; value: string | string[] }
  // for range type
  min?: number
  max?: number
  step?: number
  unit?: string
  // for nested loop type:
  sub_fields?: LoopSubField[]
  min_items?: number
  max_items?: number
}

export interface User {
  id: string
  email: string
  username: string | null
  username_set_at: string | null
  plan: Plan
  billing_interval: BillingInterval
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  current_period_end: string | null
  payment_failed_at: string | null
  deactivated_at: string | null
  is_admin: boolean
  created_at: string
}

export interface Template {
  id: string
  title: string
  description: string
  preview_images: string[]
  domain: string
  r2_bundle_path: string | null
  status: TemplateStatus
  placeholder_schema: PlaceholderSchema
  is_test: boolean
  is_free: boolean
  created_at: string
  updated_at: string
}

export interface TemplateAccess {
  id: string
  template_id: string
  user_id: string
  granted_at: string
  granted_by: string | null
  users?: { email: string; username: string | null }
}

export interface PlaceholderSchema {
  version: number
  fields: PlaceholderField[]
}

export interface PlaceholderField {
  key: string
  label: string
  type: PlaceholderType
  required: boolean
  default_value?: string
  placeholder_text?: string
  max_length?: number
  min_length?: number
  options?: string[]         // for select / dropdown type
  card_options?: CardOption[] // for card_select type
  display_mode?: 'chips' | 'toggle' // for card_select type
  section?: string
  order: number
  aspect_ratio?: string       // for image type
  sub_fields?: LoopSubField[] // for loop type
  min_items?: number          // for loop type
  max_items?: number          // for loop type
  // for range type
  min?: number
  max?: number
  step?: number
  unit?: string               // e.g. "px", "%"
  // visibility condition based on another top-level field's value
  show_when?: { field: string; value: string | string[] }
}

export interface CardOption {
  value: string
  label: string
  description: string
  card_type: 'text' | 'image' | 'color'
  image_url: string
  color: string
  /** SVG path 'd' attribute (24×24 viewBox) rendered next to the label. */
  icon?: string
}

export interface UserSite {
  id: string
  user_id: string
  template_id: string
  status: SiteStatus
  published_at: string | null
  deactivated_at: string | null
  scheduled_deletion_at: string | null
  created_at: string
  template?: Template
}

export interface SiteData {
  id: string
  user_site_id: string
  field_key: string
  field_value: string | null
  updated_at: string
}

export interface SiteImage {
  id: string
  user_site_id: string
  field_key: string
  r2_path: string
  public_url: string
  created_at: string
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'textarea' | 'email' | 'tel' | 'number' | 'url' | 'select' | 'radio' | 'checkbox'

export interface FormField {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  placeholder?: string
  options?: string[]  // for select / radio
}

export interface FormSchema {
  id: string
  template_id: string
  form_name: string
  title: string
  fields: FormField[]
  email_notification_enabled: boolean
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  user_site_id: string
  form_name: string
  data: Record<string, string>
  submitter_ip_hash: string | null
  is_spam: boolean
  read_at: string | null
  archived_at: string | null
  created_at: string
  // Joined fields (when fetched with relations)
  user_sites?: {
    id: string
    user_id: string
    templates?: {
      title: string
      domain: string
    }
  }
}
