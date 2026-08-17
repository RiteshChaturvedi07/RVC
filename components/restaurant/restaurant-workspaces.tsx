'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AlertTriangle, ChefHat, CreditCard, Edit3, Eye, Grid3X3, Layers, Loader2, Package, Plus, Printer, QrCode, Search, Table2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'
import { RestaurantOrders } from './restaurant-orders'
import { RestaurantTables } from './restaurant-tables'
import { RestaurantMenuBuilder } from './restaurant-menu-builder'

type Table={id:string;table_number:string;display_name:string|null;seats:number|null;status:string;public_token:string}
type Category={id:string;name:string;sort_order:number}
type Item={id:string;category_id:string|null;name:string;description:string|null;price:number;is_available:boolean;is_featured:boolean;image_url?:string|null}
type Order={id:string;order_number:number;table_id:string;status:string;payment_status:string;payment_method:string|null;total:number;created_at:string;customer_name?:string|null;customer_phone?:string|null;restaurant_tables?:{table_number:string}|null;restaurant_order_items:{item_name:string;quantity:number}[]}

const db=()=>createClient();
const uploadId=()=>globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2,12)}`

export function formatTableBadge(num: string | null | undefined): string {
  if (!num) return 'T-01'
  const trimmed = num.trim()
  if (/^\d+$/.test(trimmed)) {
    return `T-${trimmed.padStart(2, '0')}`
  }
  return trimmed
}

function useRestaurantData<T>(load:(tenant:string)=>Promise<T>){const[data,setData]=useState<T|null>(null),[tenant,setTenant]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);const refresh=async()=>{setLoading(true);try{const id=tenant||await currentRestaurantTenant();setTenant(id);setData(await load(id));setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load data')}finally{setLoading(false)}};useEffect(()=>{refresh()},[]);useEffect(()=>{if(!tenant)return;const timer=window.setInterval(async()=>{try{setData(await load(tenant));setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to refresh data')}},10000);return()=>window.clearInterval(timer)},[tenant]);return{data,tenant,error,loading,refresh}}
function Header({title,description,action}:{title:string;description:string;action?:React.ReactNode}){return <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-3xl font-semibold">{title}</h2><p className="mt-1 text-muted-foreground">{description}</p></div>{action}</div>}
function Busy({error}:{error:string}){return <div className="grid min-h-64 place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">{error||<Loader2 className="animate-spin"/>}</div>}

export { RestaurantTables as RestaurantTablesBoard }
export { RestaurantMenuBuilder }

function useOrders(){return useRestaurantData(async t=>{const{data,error}=await db().from('restaurant_orders').select('*,restaurant_tables(table_number),restaurant_order_items(item_name,quantity)').eq('tenant_id',t).order('created_at',{ascending:false});if(error)throw error;return(data??[])as Order[]})}
const Guest=({order}:{order:Order})=><div className="text-xs text-muted-foreground"><b className="mr-2 rounded-md bg-primary/10 px-2 py-1 text-primary">📍 Table {formatTableBadge(order.restaurant_tables?.table_number)}</b>{order.customer_name||order.customer_phone?<>👤 {order.customer_name||'Guest'}{order.customer_phone?` (${order.customer_phone})`:''}</>:null}</div>

import { RestaurantKitchen } from './restaurant-kitchen'

export { RestaurantOrders as RestaurantOrdersTable } from './restaurant-orders'
export { RestaurantKitchen as RestaurantKitchenBoard }

import { RestaurantAnalytics } from './restaurant-analytics'

import { RestaurantStaff } from './restaurant-staff'
import { RestaurantFinance } from './restaurant-finance'
import { RestaurantCustomers } from './restaurant-customers'
import { RestaurantSupport } from './restaurant-support'
import { RestaurantBilling } from './restaurant-billing'
import { RestaurantSettings } from './restaurant-settings'

export { RestaurantInventory } from './restaurant-inventory'
export { RestaurantMarketing } from './restaurant-marketing'
export { RestaurantAnalytics as RestaurantAnalyticsBoard }
export { RestaurantStaff as RestaurantStaffBoard }
export { RestaurantFinance as RestaurantFinanceBoard }
export { RestaurantCustomers as RestaurantCustomersBoard }
export { RestaurantSupport as RestaurantSupportBoard }
export { RestaurantBilling as RestaurantBillingBoard }
export { RestaurantSettings as RestaurantSettingsBoard }

export function RestaurantSimpleWorkspace({title,description,children}:{title:string;description:string;children?:React.ReactNode}){return <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><ChefHat className="mx-auto text-primary"/><h2 className="mt-4 text-2xl font-semibold">{title}</h2><p className="mt-2 text-muted-foreground">{description}</p>{children&&<div className="mt-6 text-left">{children}</div>}</div>}


