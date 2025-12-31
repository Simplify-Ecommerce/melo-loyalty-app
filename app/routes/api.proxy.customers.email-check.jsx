import { authenticate } from "../shopify.server";
import { getAdminFromShop } from "../utils/app-proxy.server";

export const action = async ({ request }) => {
  try {
    // Validar el app proxy request (valida la firma)
    await authenticate.public.appProxy(request);
    
    // Obtener el shop del request
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    
    if (!shop) {
      return Response.json({ error: "Shop parameter is required" }, { status: 400 });
    }

    // Obtener el cliente admin desde el shop
    const admin = await getAdminFromShop(shop);
    
    if (!admin) {
      return Response.json({ 
        error: "App not installed or session not available. Please authenticate the app first by accessing it from the Shopify admin." 
      }, { status: 401 });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json();
    const email = body.email?.trim();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Buscar cliente por email usando GraphQL
    const checkEmailQuery = `
      query checkCustomerEmail($query: String!) {
        customers(first: 1, query: $query) {
          nodes {
            id
            email
          }
        }
      }
    `;

    // Usar comillas para búsqueda exacta del email
    const searchQuery = `email:"${email}"`;

    const response = await admin.graphql(checkEmailQuery, {
      variables: {
        query: searchQuery,
      },
    });

    const responseData = await response.json();

    if (responseData.errors) {
      console.error("Error checking email:", responseData.errors);
      return Response.json({ error: "Error al verificar el email" }, { status: 500 });
    }

    const customers = responseData.data?.customers?.nodes || [];
    const emailExists = customers.length > 0;

    return Response.json({
      exists: emailExists,
      message: emailExists ? "Este email ya está registrado" : null,
    });
  } catch (error) {
    console.error("Error checking email:", error);
    return Response.json(
      { error: error.message || "Error al verificar el email" },
      { status: 500 }
    );
  }
};

