'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
const required:Record<string,string|undefined>={
 '/restaurant-dashboard':'Overview',
 '/restaurant-dashboard/orders':'Orders',
 '/restaurant-dashboard/tables':'Tables & QR',
 '/restaurant-dashboard/kitchen':'Kitchen',
 '/restaurant-dashboard/menu':'Menu Builder',
 '/restaurant-dashboard/inventory':'Inventory',
 '/restaurant-dashboard/customers':'Customers',
 '/restaurant-dashboard/marketing':'Marketing',
 '/restaurant-dashboard/analytics':'Analytics',
 '/restaurant-dashboard/finance':'Finance',
 '/restaurant-dashboard/staff':'Staff',
 '/restaurant-dashboard/billing':'Billing',
 '/restaurant-dashboard/support':'Support',
 '/restaurant-dashboard/settings':'Settings'
}
export function StaffPermissionGuard({children}:{children:React.ReactNode}){const pathname=usePathname(),[allowed,setAllowed]=useState<boolean|null>(null);useEffect(()=>{const check=async()=>{const db=createClient(),{data:{user}}=await db.auth.getUser();if(!user)return setAllowed(false);const{data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();if(profile?.role==='tenant_owner')return setAllowed(true);const need=required[pathname];if(!need)return setAllowed(true);const{data:assignment}=await db.from('restaurant_staff_assignments').select('permissions,is_active').eq('profile_id',user.id).maybeSingle();setAllowed(!!assignment?.is_active&&(assignment.permissions||[]).includes(need))};void check()},[pathname]);if(allowed===null)return <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Checking staff permissions…</div>;if(!allowed)return <div className="grid min-h-[55vh] place-items-center p-5 text-center"><section className="max-w-md rounded-3xl border bg-card p-8"><ShieldAlert className="mx-auto size-12 text-red-500"/><h2 className="mt-4 text-2xl font-bold">Access restricted</h2><p className="mt-2 text-muted-foreground">Your restaurant owner has not given your staff account access to this workspace.</p></section></div>;return <>{children}</>}
