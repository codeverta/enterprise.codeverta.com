import api from "@/lib/api";

export type CustomerGroup = { id?:string; group_name:string; parent_group:string; is_group:boolean; default_price_list:string; payment_terms:string; default_receivable_account:string; advance_account:string; credit_limit:number; bypass_credit_limit_sales_order:boolean };
export type Address = { id?:string; address_title:string; address_type:string; address_line1:string; address_line2:string; city:string; county:string; state:string; country:string; postal_code:string; phone:string; fax:string; email:string; tax_category:string; linked_doctype:string; linked_name:string; is_primary_address:boolean; is_shipping_address:boolean; is_your_company_address:boolean; disabled:boolean };
export type Contact = { id?:string; first_name:string; middle_name:string; last_name:string; status:string; designation:string; company_name:string; email_id:string; alternate_email_id:string; phone:string; mobile_no:string; linked_doctype:string; linked_name:string; user_id:string; is_primary_contact:boolean; disabled:boolean; notes:string };
export type CustomerMaster = CustomerGroup | Address | Contact;
export type CustomerMasterKind = "customer-group" | "address" | "contact";

const endpoint = {"customer-group":"customer-groups",address:"addresses",contact:"contacts"} as const;
const unwrap = (response:any) => response?.data?.data ?? response?.data ?? response;
export const customerMasterApi = {
  list: async <T extends CustomerMaster>(kind:CustomerMasterKind,q="") => unwrap(await api.get(`/selling/${endpoint[kind]}`,{params:{q}})) as T[],
  get: async <T extends CustomerMaster>(kind:CustomerMasterKind,id:string) => unwrap(await api.get(`/selling/${endpoint[kind]}/${id}`)) as T,
  create: async <T extends CustomerMaster>(kind:CustomerMasterKind,data:T) => unwrap(await api.post(`/selling/${endpoint[kind]}`,data)) as T,
  update: async <T extends CustomerMaster>(kind:CustomerMasterKind,id:string,data:T) => unwrap(await api.put(`/selling/${endpoint[kind]}/${id}`,data)) as T,
  remove: async (kind:CustomerMasterKind,id:string) => api.delete(`/selling/${endpoint[kind]}/${id}`),
};
