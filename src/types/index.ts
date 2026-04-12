export type Plan = 'starter' | 'pro' | 'unlimited'
export type BillingInterval = 'monthly' | 'yearly'
export type SiteStatus = 'draft' | 'published' | 'deactivated' | 'deleted'
export type TemplateStatus = 'draft' | 'published'
export type PlaceholderType = 'text' | 'textarea' | 'image' | 'url' | 'email' | 'select'

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
  created_at: string
  updated_at: string
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
  options?: string[] // for select type
  section?: string // grouping label
  order: number
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
