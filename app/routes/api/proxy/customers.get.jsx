import { authenticate } from "../../../shopify.server";

export const loader = async ({ request }) => {
  try {
    const auth = await authenticate.public.appProxy(request);
    
    if (!auth.admin) {
      return Response.json({ error: "App not installed or session not available" }, { status: 401 });
    }

    const { admin } = auth;

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
          metafields(first: 20, namespace: "loyalty") {
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

    const metafieldsMap = {};
    metafields.forEach((mf) => {
      metafieldsMap[mf.key] = mf.value;
    });

    const requiredFields = [
      "document_type",
      "document_number",
      "first_name",
      "last_name",
      "birth_date",
      "gender",
      "phone",
      "phone_country_code",
      "province",
      "district",
      "corregimiento"
    ];

    const missingFields = requiredFields.filter(
      (field) => !metafieldsMap[field] || metafieldsMap[field].trim() === ""
    );

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
      missingFields,
    });
  } catch (error) {
    console.error("Error getting customer:", error);
    return Response.json(
      { error: error.message || "Error al obtener datos del cliente" },
      { status: 500 }
    );
  }
};

