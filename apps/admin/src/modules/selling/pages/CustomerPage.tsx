import React from "react";
import { useLocation, useParams } from "react-router";
import CustomerListPage from "./CustomerListPage";
import CustomerFormPage from "./CustomerFormPage";

export { CustomerListPage, CustomerFormPage };

export default function CustomerPage() {
  const { pathname } = useLocation();
  const { id } = useParams();

  const isForm =
    pathname === "/desk/customer/new" ||
    pathname.includes("/desk/customer/new-customer") ||
    pathname.endsWith("/new") ||
    (Boolean(id) && id !== "view" && id !== "customer");

  if (isForm) {
    return <CustomerFormPage />;
  }

  return <CustomerListPage />;
}
