import { authenticate } from "../../../shopify.server";
import { validateCustomerData } from "../../../utils/validations.server";

export const action = async ({ request }) => {
  try {
    const auth = await authenticate.public.appProxy(request);
    
    if (!auth.admin) {
      return Response.json({ error: "App not installed or session not available" }, { status: 401 });
    }

    const { admin } = auth;

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json();
    const validation = validateCustomerData(body);

    if (!validation.valid) {
      return Response.json({ error: validation.errors.join(", ") }, { status: 400 });
    }

    const metafields = [
      {
        namespace: "loyalty",
        key: "document_type",
        type: "single_line_text_field",
        value: body.document_type,
      },
      {
        namespace: "loyalty",
        key: "document_number",
        type: "single_line_text_field",
        value: body.document_number,
      },
      {
        namespace: "loyalty",
        key: "first_name",
        type: "single_line_text_field",
        value: body.first_name,
      },
      {
        namespace: "loyalty",
        key: "last_name",
        type: "single_line_text_field",
        value: body.last_name,
      },
      {
        namespace: "loyalty",
        key: "birth_date",
        type: "date",
        value: body.birth_date,
      },
      {
        namespace: "loyalty",
        key: "gender",
        type: "single_line_text_field",
        value: body.gender,
      },
      {
        namespace: "loyalty",
        key: "phone",
        type: "single_line_text_field",
        value: body.phone,
      },
      {
        namespace: "loyalty",
        key: "phone_country_code",
        type: "single_line_text_field",
        value: body.phone_country_code,
      },
      {
        namespace: "loyalty",
        key: "province",
        type: "single_line_text_field",
        value: body.province,
      },
      {
        namespace: "loyalty",
        key: "district",
        type: "single_line_text_field",
        value: body.district,
      },
      {
        namespace: "loyalty",
        key: "corregimiento",
        type: "single_line_text_field",
        value: body.corregimiento,
      },
      {
        namespace: "loyalty",
        key: "wants_custom_invoice",
        type: "boolean",
        value: "true",
      },
    ];

    const createCustomerMutation = `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
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
      email: body.email,
      firstName: body.first_name,
      lastName: body.last_name,
      phone: body.phone_country_code + body.phone,
      metafields: metafields,
    };

    const response = await admin.graphql(createCustomerMutation, {
      variables: {
        input: customerInput,
      },
    });

    const responseData = await response.json();

    if (responseData.data.customerCreate.userErrors.length > 0) {
      const errors = responseData.data.customerCreate.userErrors
        .map((err) => err.message)
        .join(", ");
      return Response.json({ error: errors }, { status: 400 });
    }

    const customer = responseData.data.customerCreate.customer;

    return Response.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    return Response.json(
      { error: error.message || "Error al crear el cliente" },
      { status: 500 }
    );
  }
};

