import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  try {
    let admin;
    try {
      const auth = await authenticate.public.appProxy(request);
      if (!auth.admin) {
        return Response.json({ error: "App not installed or session not available" }, { status: 401 });
      }
      admin = auth.admin;
    } catch (error) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const customerId = url.searchParams.get("customer_id") || url.searchParams.get("id");

    if (!customerId) {
      return Response.json({ error: "Customer ID is required" }, { status: 400 });
    }

    const getCustomerQuery = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          phone
          metafields(first: 30, namespace: "loyalty") {
            edges {
              node {
                id
                key
                value
                type
              }
            }
          }
          exchanger_metafields: metafields(first: 30, namespace: "exchanger") {
            edges {
              node {
                id
                key
                value
                type
              }
            }
          }
        }
      }
    `;

    const response = await admin.graphql(getCustomerQuery, {
      variables: {
        id: customerId,
      },
    });

    const data = await response.json();

    if (!data.data.customer) {
      return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const customer = data.data.customer;
    const metafields = customer.metafields.edges.map((edge) => edge.node);
    const metafieldsExchanger =
      customer.exchanger_metafields.edges.map((edge) => edge.node);

    const metafieldsMap = {};
    metafields.forEach((mf) => {
      metafieldsMap[mf.key] = mf.value;
    });
    metafieldsExchanger.forEach((mf) => {
      metafieldsMap[mf.key] = mf.value;
    });

    // Determinar qué campos son requeridos según el tipo de cliente
    const customerType = metafieldsMap["ex_customer_type"] || "";
    
    // Campos siempre requeridos (nativos y metafields básicos)
    const missingFields = [];
    
    // Verificar campos nativos
    if (!customer.firstName) missingFields.push("first_name");
    if (!customer.lastName) missingFields.push("last_name");
    if (!customer.email) missingFields.push("email");
    
    // Verificar campos básicos de metafields
    if (!metafieldsMap["ex_birthday"] || metafieldsMap["ex_birthday"].trim() === "") {
      missingFields.push("birth_date");
    }
    if (!metafieldsMap["ex_gender"] || metafieldsMap["ex_gender"].trim() === "") {
      missingFields.push("gender");
    }
    if (!metafieldsMap["ex_phone"] || metafieldsMap["ex_phone"].trim() === "") {
      missingFields.push("phone");
    }
    if (!metafieldsMap["ex_phone_country_code"] || metafieldsMap["ex_phone_country_code"].trim() === "") {
      missingFields.push("phone_country_code");
    }
    
    // Verificar campos condicionales según tipo de cliente
    if (customerType === "01") {
      // Contribuyente
      if (!metafieldsMap["ex_tax_id"] || metafieldsMap["ex_tax_id"].trim() === "") {
        missingFields.push("document_number");
      }
      if (!metafieldsMap["ex_customer_dv"] || metafieldsMap["ex_customer_dv"].trim() === "") {
        missingFields.push("customer_dv");
      }
      if (!metafieldsMap["ex_taxpayer_name"] || metafieldsMap["ex_taxpayer_name"].trim() === "") {
        missingFields.push("taxpayer_name");
      }
      if (!metafieldsMap["ex_taxpayer_kind"] || metafieldsMap["ex_taxpayer_kind"].trim() === "") {
        missingFields.push("taxpayer_kind");
      }
      // Campos de ubicación para contribuyente
      if (!metafieldsMap["ex_province"] || metafieldsMap["ex_province"].trim() === "") {
        missingFields.push("province");
      }
      if (!metafieldsMap["ex_district"] || metafieldsMap["ex_district"].trim() === "") {
        missingFields.push("district");
      }
      if (!metafieldsMap["ex_corregimiento"] || metafieldsMap["ex_corregimiento"].trim() === "") {
        missingFields.push("corregimiento");
      }
    } else if (customerType === "02") {
      // Consumidor final
      if (!metafieldsMap["ex_tax_id"] || metafieldsMap["ex_tax_id"].trim() === "") {
        missingFields.push("document_number");
      }
      if (!metafieldsMap["ex_taxpayer_kind"] || metafieldsMap["ex_taxpayer_kind"].trim() === "") {
        missingFields.push("taxpayer_kind");
      }
      // Consumidor final NO requiere campos de ubicación
    } else if (customerType === "04") {
      // Extranjero
      if (!metafieldsMap["ex_tax_id"] || metafieldsMap["ex_tax_id"].trim() === "") {
        missingFields.push("document_number");
      }
      // Extranjero NO requiere campos de ubicación
    } else {
      // Si no hay tipo de cliente, es un campo faltante crítico
      // Pero no lo agregamos a missingFields porque no tiene sentido validar otros campos sin tipo
    }

    // DEBUG TEMPORAL: Mostrar campos llenos y faltantes
    console.log("[DEBUG API] Metafields encontrados:", metafieldsMap);
    console.log("[DEBUG API] Tipo de cliente:", customerType);
    console.log("[DEBUG API] Campos FALTANTES:", missingFields);
    console.log("[DEBUG API] Customer firstName:", customer.firstName);
    console.log("[DEBUG API] Customer lastName:", customer.lastName);
    console.log("[DEBUG API] Customer email:", customer.email);
    console.log("[DEBUG API] ex_tax_id:", metafieldsMap["ex_tax_id"]);
    console.log("[DEBUG API] ex_customer_dv:", metafieldsMap["ex_customer_dv"]);
    console.log("[DEBUG API] ex_taxpayer_kind:", metafieldsMap["ex_taxpayer_kind"]);
    console.log("[DEBUG API] ex_province:", metafieldsMap["ex_province"]);
    console.log("[DEBUG API] ex_district:", metafieldsMap["ex_district"]);
    console.log("[DEBUG API] ex_corregimiento:", metafieldsMap["ex_corregimiento"]);

    const complete = missingFields.length === 0;

    return Response.json({
      complete,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        metafields: metafieldsMap,
      },
      missingFields: missingFields || [],
    });
  } catch (error) {
    console.error("Error getting customer:", error);
    return Response.json(
      { error: error.message || "Error al obtener datos del cliente" },
      { status: 500 }
    );
  }
};

