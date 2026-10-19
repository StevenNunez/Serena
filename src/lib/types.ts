export type ProductStatus = "draft" | "available" | "reserved" | "sold" | "hidden";

export type Theme = {
  primary?: string;
  accent?: string;
  logo?: string;
  tagline?: string;
};

export type DeliveryOption = { enabled: boolean; cost: number; label: string };

export type TenantSettings = {
  currency: string;
  reservation_minutes: number;
  payment_minutes: number;
  max_strikes: number;
  delivery: Record<"pickup" | "courier" | "delivery", DeliveryOption>;
  payments: { transfer: boolean; mercadopago: boolean; khipu: boolean };
  /** Cuánto se conserva una pieza vendida (solo para quien la compró). Por defecto 24 h */
  sold_retention_hours?: number;
  /** Cuánto se conserva el comprobante de un pedido cerrado. Por defecto 30 días */
  proof_retention_days?: number;
  /** Dónde y cuándo se retiran los pedidos en tienda */
  pickup_info?: { address?: string; hours?: string; notes?: string };
  /** Datos del pie de los correos */
  social?: { instagram?: string; tiktok?: string; youtube?: string; facebook?: string };
  legal?: { nombre?: string; rut?: string; direccion?: string };
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  theme: Theme;
  settings: TenantSettings;
};

export type Category = { id: string; name: string; slug: string; sort: number };

export type Product = {
  id: string;
  tenant_id: string;
  number: number;
  title: string;
  description: string | null;
  category_id: string | null;
  size: string | null;
  color: string | null;
  condition: string | null;
  price: number;
  photos: string[];
  status: ProductStatus;
  reserved_by: string | null;
  reserved_until: string | null;
  order_id: string | null;
  created_at: string;
};

export type ReserveResult =
  | { result: "reserved" | "mine"; until: string }
  | { result: "waitlisted"; position: number }
  | { result: "sold" | "blocked" };

export type Role = "admin" | "live" | "caja";

export type Address = { street?: string; commune?: string; region?: string; notes?: string };

export type Bank = {
  holder?: string;
  rut?: string;
  bank?: string;
  account_type?: string;
  account?: string;
  email?: string;
};

export type OrderStatus =
  | "pending_payment" | "payment_review" | "paid" | "preparing"
  | "shipped" | "delivered" | "cancelled" | "expired";

export type DeliveryMethod = "pickup" | "courier" | "delivery";

export type OrderItem = {
  id: string;
  product_id: string | null;
  product_number: number;
  title: string;
  photo: string | null;
  price: number;
};

export type Order = {
  id: string;
  tenant_id: string;
  number: number;
  customer_id: string;
  status: OrderStatus;
  payment_method: "transfer" | "mercadopago" | "khipu";
  payment_ref: string;
  delivery_method: DeliveryMethod;
  shipping_address: Address;
  subtotal: number;
  shipping_cost: number;
  total: number;
  expires_at: string | null;
  proof_path: string | null;
  paid_at: string | null;
  tracking: string | null;
  notes: string | null;
  created_at: string;
  order_items?: OrderItem[];
};

export type Customer = {
  tenant_id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: Address;
  strikes: number;
  blocked: boolean;
};

export type LiveSession = {
  id: string;
  title: string;
  status: "live" | "ended";
  current_product_id: string | null;
  platform: "instagram" | "tiktok" | "youtube" | "facebook" | null;
  stream_url: string | null;
};
