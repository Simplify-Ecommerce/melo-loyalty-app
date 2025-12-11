import { authenticate } from "../shopify.server";
import { validateCustomerData } from "../utils/validations.server";

export const action = async ({ request }) => {
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

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json();
    
    if (!body.customer_id) {
      return Response.json({ error: "Customer ID is required" }, { status: 400 });
    }

    const validation = validateCustomerData(body);

    if (!validation.valid) {
      return Response.json({ error: validation.errors.join(", ") }, { status: 400 });
    }

    const getCustomerQuery = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          metafields(first: 20, namespace: "loyalty") {
            edges {
              node {
                id
                key
                value
              }
            }
          }
        }
      }
    `;

    const customerResponse = await admin.graphql(getCustomerQuery, {
      variables: {
        id: body.customer_id,
      },
    });

    const customerData = await customerResponse.json();

    if (!customerData.data.customer) {
      return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const existingMetafields = customerData.data.customer.metafields.edges.map(
      (edge) => edge.node
    );

    const existingDocumentNumber = existingMetafields.find(
      (mf) => mf.key === "document_number"
    )?.value;

    const existingEmail = customerData.data.customer.email;

    if (existingDocumentNumber && body.document_number !== existingDocumentNumber) {
      return Response.json(
        { error: "El número de documento no puede ser modificado" },
        { status: 400 }
      );
    }

    if (body.email !== existingEmail) {
      return Response.json(
        { error: "El email no puede ser modificado" },
        { status: 400 }
      );
    }

    const metafieldsToSet = [
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "document_type",
        type: "single_line_text_field",
        value: body.document_type,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "document_number",
        type: "single_line_text_field",
        value: body.document_number,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "first_name",
        type: "single_line_text_field",
        value: body.first_name,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "last_name",
        type: "single_line_text_field",
        value: body.last_name,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "birth_date",
        type: "date",
        value: body.birth_date,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "gender",
        type: "single_line_text_field",
        value: body.gender,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "phone",
        type: "single_line_text_field",
        value: body.phone,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "phone_country_code",
        type: "single_line_text_field",
        value: body.phone_country_code,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "province",
        type: "single_line_text_field",
        value: body.province,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "district",
        type: "single_line_text_field",
        value: body.district,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "corregimiento",
        type: "single_line_text_field",
        value: body.corregimiento,
      },
      {
        ownerId: body.customer_id,
        namespace: "loyalty",
        key: "wants_custom_invoice",
        type: "boolean",
        value: "true",
      },
    ];

    const updateCustomerMutation = `
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            email
            firstName
            lastName
            phone
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const customerInput = {
      id: body.customer_id,
      firstName: body.first_name,
      lastName: body.last_name,
      phone: body.phone_country_code + body.phone,
    };

    const updateResponse = await admin.graphql(updateCustomerMutation, {
      variables: {
        input: customerInput,
      },
    });

    const updateData = await updateResponse.json();

    if (updateData.data.customerUpdate.userErrors.length > 0) {
      const errors = updateData.data.customerUpdate.userErrors
        .map((err) => err.message)
        .join(", ");
      return Response.json({ error: errors }, { status: 400 });
    }

    const setMetafieldsMutation = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const metafieldsResponse = await admin.graphql(setMetafieldsMutation, {
      variables: {
        metafields: metafieldsToSet,
      },
    });

    const metafieldsData = await metafieldsResponse.json();

    if (metafieldsData.data.metafieldsSet.userErrors.length > 0) {
      const errors = metafieldsData.data.metafieldsSet.userErrors
        .map((err) => err.message)
        .join(", ");
      return Response.json({ error: errors }, { status: 400 });
    }

    return Response.json({
      success: true,
      customer: updateData.data.customerUpdate.customer,
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return Response.json(
      { error: error.message || "Error al actualizar el cliente" },
      { status: 500 }
    );
  }
};

