
// FIX: Import React to resolve 'Cannot find namespace React' error.
import React from 'react';

export enum Role {
  ADMIN = 'ADMIN',
  PROVIDER = 'PROVIDER',
  CLIENT = 'CLIENT',
  MODERATOR = 'MODERATOR'
}

export enum ProviderStatus {
  PENDING = 'Pendiente',
  IN_REVIEW = 'En Revisión',
  APPROVED = 'Aprobado',
  REJECTED = 'Rechazado',
  ACTIVE = 'Activo',
  SUSPENDED = 'Suspendido',
  INACTIVE = 'Inactivo',
  BANNED = 'Baneado',
}

export enum ClientStatus {
  PENDIENTE = 'Pendiente',
  REGISTRADO = 'Registrado',
  VERIFICADO = 'Verificado',
  SOSPECHOSO = 'Sospechoso',
  BLOQUEADO = 'Bloqueado',
  INACTIVO = 'Inactivo',
}

export type Page =
  | 'home'
  | 'auth'
  | 'provider-register'
  | 'client-register'
  | 'login'
  | 'forgot-password'
  | 'reset-password'
  | 'style-guide'
  | 'admin-dashboard'
  | 'provider-dashboard'
  | 'client-dashboard'
  | 'search'
  | 'service-detail'
  | 'provider-profile'
  | 'checkout'
  | 'categories'
  | 'category-detail';

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
}

// --- Policy & Legal Types ---
export type PolicyTarget = 'global' | 'client' | 'provider';

export interface PolicyDocument {
  id: string;
  title: string;
  slug?: string;
  content: string; // HTML or Markdown
  target: PolicyTarget;
  lastUpdated: string; // ISO Date
  version: string;
  isRequired: boolean; // If true, requires explicit checkbox during signup/checkout
  isActive: boolean;
}

// --- Moderation & Support Types ---

export enum ReportReason {
  INAPPROPRIATE_CONTENT = "Contenido sexual, violento, ilegal",
  MISLEADING_DESCRIPTION = "No coincide lo ofrecido",
  FAKE_REVIEWS = "Reviews sospechosos (mismo IP)",
  SPAM = "Servicio duplicado o irrelevante",
  SCAM = "Solicita pago fuera de la plataforma",
  INFRINGEMENT = "Violación de propiedad intelectual"
}

export enum ReportStatus {
  PENDING_REVIEW = 'Pendiente de Revisión',
  APPROVED = 'Reporte Aprobado',
  REJECTED = 'Reporte Rechazado',
}

export enum ImageModerationStatus {
  PENDING = 'Pendiente',
  APPROVED = 'Aprobado',
  REJECTED = 'Rechazado'
}

export interface PendingImage {
  id: string;
  providerId: string;
  providerName: string;
  type: 'profile' | 'banner';
  imageUrl: string;
  uploadDate: string;
  status: ImageModerationStatus;
}

export interface ServiceReport {
  id: string;
  serviceId: string;
  serviceName: string;
  providerId: string;
  providerEmail: string;
  providerRut: string;
  reason: ReportReason;
  reportedBy: string; // Anonimized client ID
  timesReported: number;
  reportDate: string; // ISO Date String
  status: ReportStatus;
}

export interface ReportedReview {
  id: string;
  orderId: string;
  clientId: string; // Anonimized
  providerName: string;
  rating: number;
  content: string;
  reason: 'Fake' | 'Insulto' | 'Contenido';
}

export enum TicketCategory {
  PROVIDER_ONBOARDING = "Onboarding de Proveedor",
  PAYMENT_ISSUE = "Problema de Pago",
  SERNAC_RECLAIM = "Reclamo SERNAC",
  TECHNICAL_BUG = "Bug Técnico",
  DISPUTE = "Disputa Cliente-Proveedor"
}

export enum TicketPriority {
  HIGH = 'Alta',
  MEDIUM = 'Media',
  LOW = 'Baja'
}

export enum TicketStatus {
  OPEN = 'Abierto',
  CLOSED = 'Cerrado',
  ESCALATED = 'Escalado'
}

export interface SupportTicket {
  id: string; // e.g., #TK-2025-12345
  senderId: string;
  senderRole: 'Cliente' | 'Proveedor';
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedAgent: string; // admin email
  lastActivity: string; // ISO Date String
}


export enum DisputeStatus {
  WAITING_PROVIDER = 'Esperando a Proveedor',
  WAITING_CUSTOMER = 'Esperando a Cliente',
  IN_MEDIATION = 'En Mediación',
  RESOLVED = 'Resuelta',
}

export interface Dispute {
  id: string; // e.g., #DISP-2025-123
  orderId: string;
  orderAmount: number;
  clientId: string;
  clientName: string;
  clientRut: string;
  providerId: string;
  providerName: string;
  reason: 'No entregó' | 'No conforme';
  evidence: { client: number; provider: number }; // count of files
  deadline: string; // ISO Date String
  status: DisputeStatus;
}


// --- Transaction Engine Types ---

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  AUTHORIZED = 'AUTHORIZED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PayoutStatus {
  NONE = 'NONE',
  PAYKU_SCHEDULED = 'PAYKU_SCHEDULED',
  PAYKU_PAID = 'PAYKU_PAID',
  PAYKU_FAILED = 'PAYKU_FAILED',
}

export enum RefundStatus {
  NONE = 'NONE',
  PARTIAL = 'PARTIAL',
  FULL = 'FULL',
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string; // Helper for display
  provider_id: string;
  provider_name: string; // Helper for display
  service_id: string;
  service_name: string; // Helper for display
  amount_clp: number;
  iva_clp: number;
  total_clp: number;
  payku_transaction_id: string | null;
  payku_split_id: string | null;
  platform_commission_rate: number;
  platform_commission_clp: number;
  sii_retention_clp: number;
  provider_payout_clp: number;
  status: OrderStatus;
  raw_status?: string;
  payout_status: PayoutStatus;
  refund_status: RefundStatus;
  refund_amount_clp: number;
  webhook_received_at: string | null;
  created_at: string;
  completed_at: string | null;
  metadata: {
    coupon?: string;
    ip?: string;
    device?: string;
  };
}


// --- Finance & Payouts Types ---

export interface PayoutFailure {
  id: string;
  provider_id: string;
  provider_name: string;
  amount_clp: number;
  reason: string;
  payku_transaction_id: string;
  failed_at: string;
  resolved: boolean;
}

export enum SIIReportStatus {
  PENDING = 'Pendiente',
  GENERATED = 'Generado',
  SENT = 'Enviado',
  ERROR = 'Error',
}

export interface SIIReport {
  id: string;
  period: string; // "YYYY-MM"
  amount_clp: number;
  status: SIIReportStatus;
  generated_at: string;
  file_url: string;
}

// --- Provider Dashboard Types ---
export type ProviderDashboardView =
  | 'home'
  | 'services'
  | 'products'
  | 'orders'
  | 'finance'
  | 'profile'
  | 'support'
  | 'legal'; // Added legal view

export interface TimeRange {
  start: string;
  end: string;
}

export interface DailySchedule {
  day: string;
  active: boolean;
  timeRanges: TimeRange[];
}

export interface ServiceCategoryItem {
  categoryId: string;
  subcategory: string;
}

export interface ServiceAttribute {
  id: string;
  label: string;
  description: string;
}

export interface GalleryMediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_clp: number;
  iva_clp: number;
  type: 'presencial' | 'online' | 'hibrido';
  pricing_type?: 'per_event' | 'per_hour'; // Made optional for retro-compatibility initially
  availability_type: 'agenda' | 'inmediato' | '24h';
  categories: ServiceCategoryItem[]; // Updated to support multiple categories
  calendar_config?: {
    schedule: DailySchedule[];
  };
  requires_kyc: boolean;
  status: 'draft' | 'active' | 'paused' | 'flagged';
  videoUrl?: string;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  moderation_reason?: string;
  coverImageUrl?: string;
  imageUrls?: string[];
  galleryMedia?: GalleryMediaItem[];
  features?: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price_clp: number;
  iva_clp: number;
  sku: string;
  stock: number;
  images: string[];
  status: 'draft' | 'active' | 'paused' | 'out_of_stock';
}

export interface ServiceBooking {
  id: string;
  service_id: string;
  customerName: string;
  serviceName: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "14:00"
  endTime: string; // "15:00"
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
}

export interface RecentActivity {
  id: string;
  type: 'service' | 'product';
  item: string;
  customerEmail: string;
  date: string; // ISO String
  amount: number;
  status: 'Confirmado' | 'Pendiente' | 'Entregado' | 'Cancelado';
}

export enum ProviderOrderStatus {
  CONFIRMED = 'Confirmado',
  PENDING = 'Pendiente',
  COMPLETED = 'Entregado',
  CANCELLED = 'Cancelado',
  IN_PROGRESS = 'En Progreso',
  DISPUTE = 'En Disputa'
}

export interface OrderListItem {
  id: string;
  type: 'service' | 'product';
  item_name: string;
  customer_name: string;
  date: string; // ISO String
  amount: number;
  status: ProviderOrderStatus;
  raw_status?: string;
}

export enum PayoutProviderStatus {
  PENDING = 'Pendiente',
  IN_TRANSIT = 'En Tránsito',
  PAID = 'Pagado',
  FAILED = 'Fallido'
}

export interface ProviderPayout {
  id: string;
  date: string; // ISO string
  grossAmount: number;
  commission: number;
  siiRetention: number;
  netAmount: number;
  status: PayoutProviderStatus;
}

export interface ProviderTransaction {
  id: string;
  date: string; // ISO string
  orderId: string;
  clientName: string;
  type: 'service' | 'product';
  totalAmount: number;
  yourEarning: number;
}

// --- Client Dashboard Types ---
export type ClientDashboardView =
  | 'orders'
  | 'scheduled'
  | 'products'
  | 'favorites'
  | 'claims'
  | 'billing'
  | 'legal'
  | 'security';

export enum ClientOrderStatus {
  PENDING_PAYMENT = 'Pendiente de Pago',
  PROCESSING = 'Pagada / En Proceso',
  SERVICE_TODO = 'Servicio por Realizar',
  PRODUCT_SHIPPED = 'Producto Enviado',
  COMPLETED = 'Completada',
  REFUNDED = 'Reembolsada'
}

export interface ClientOrder {
  id: string;
  orderNumber: string;
  date: string; // ISO String
  providerName: string;
  items: { name: string; quantity: number }[];
  total: number;
  status: ClientOrderStatus;
  trackingNumber?: string;
  serviceDate?: string; // "YYYY-MM-DD"
}

// --- Freight / Moving Service Types ---

export interface FreightVehicle {
  id: string;
  service_id: string;
  name: string;
  height_cm: number;
  width_cm: number;
  depth_cm: number;
  max_weight_kg?: number;
  is_available: boolean;
  volume_m3: number; // Calculated: (h*w*d)/1_000_000
}

export interface FreightPricingConfig {
  base_price: number;      // CLP per trip/vehicle
  price_per_km: number;    // CLP per km
  max_distance_km: number; // Cap (default: 1000)
}

export interface FreightRouteData {
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  dest_address: string;
  dest_lat: number;
  dest_lng: number;
  distance_km: number;
  duration_minutes: number;
}

export type LogisticsMode = 'single_trip' | 'multi_trip' | 'multi_vehicle';

export interface LogisticsPlan {
  mode: LogisticsMode;
  vehicles: { id: string; name: string; volume_m3: number }[];
  trips_count: number;
  total_vehicle_volume_m3: number;
  client_volume_m3: number;
  explanation: string;
  price_breakdown: {
    base_per_unit: number;
    units: number;
    distance_km: number;
    price_per_km: number;
    km_multiplier: number;
    total: number;
  };
  is_recommended: boolean;
}

export interface FreightBookingData {
  route: FreightRouteData;
  selectedPlan: LogisticsPlan;
}
