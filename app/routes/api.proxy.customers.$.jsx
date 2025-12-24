import { authenticate } from "../shopify.server";
import { validateCustomerData } from "../utils/validations.server";

export const loader = async ({ request, params }) => {
  try {
    const auth = await authenticate.public.appProxy(request);
    
    if (!auth.admin) {
      return Response.json({ error: "App not installed or session not available" }, { status: 401 });
    }

    const { admin } = auth;
    const action = params["*"];

    if (action === "get") {
      const url = new URL(request.url);
      let customerId = url.searchParams.get("customer_id") || url.searchParams.get("id");

      if (!customerId) {
        return Response.json({ error: "Customer ID is required" }, { status: 400 });
      }

      // Convertir el ID al formato GraphQL de Shopify si es necesario
      // Shopify espera el formato: gid://shopify/Customer/123456789
      if (!customerId.startsWith("gid://")) {
        // Si es solo un número, convertirlo al formato correcto
        const numericId = customerId.replace(/\D/g, "");
        if (numericId) {
          customerId = `gid://shopify/Customer/${numericId}`;
        } else {
          return Response.json({ error: "Invalid customer ID format" }, { status: 400 });
        }
      }

      const getCustomerQuery = `
        query getCustomer($id: ID!) {
          customer(id: $id) {
            id
            email
            firstName
            lastName
            phone
            metafields(first: 25, namespace: "exchanger") {
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

      // Campos siempre requeridos
      const alwaysRequired = [
        "ex_birthday",
        "ex_gender",
        "ex_phone",
        "ex_customer_type"
      ];

      // Verificar campos siempre requeridos
      const missingAlways = alwaysRequired.filter(
        (field) => !metafieldsMap[field] || metafieldsMap[field].trim() === ""
      );

      // Verificar campos nativos
      const missingNative = [];
      if (!customer.firstName) missingNative.push("first_name");
      if (!customer.lastName) missingNative.push("last_name");
      if (!customer.email) missingNative.push("email");

      // Verificar campos condicionales según tipo de cliente
      const customerType = metafieldsMap["ex_customer_type"];
      let missingConditional = [];

      if (customerType === "01") {
        // Contribuyente
        const contribuyenteFields = ["ex_tax_id", "ex_customer_dv", "ex_taxpayer_name", "ex_taxpayer_kind"];
        missingConditional = contribuyenteFields.filter(
          (field) => !metafieldsMap[field] || metafieldsMap[field].trim() === ""
        );
      } else if (customerType === "02") {
        // Consumidor final
        const consumidorFields = ["ex_tax_id", "ex_taxpayer_kind"];
        missingConditional = consumidorFields.filter(
          (field) => !metafieldsMap[field] || metafieldsMap[field].trim() === ""
        );
        // Razón Social es opcional (se auto-completa)
      } else if (customerType === "04") {
        // Extranjero
        const extranjeroFields = ["ex_tax_id"];
        missingConditional = extranjeroFields.filter(
          (field) => !metafieldsMap[field] || metafieldsMap[field].trim() === ""
        );
      }

      // Si es Panamá (01 o 02), verificar campos de ubicación
      if (customerType === "01" || customerType === "02") {
        // Por ahora, los campos de ubicación usan "test", así que no los validamos estrictamente
        // En el futuro, cuando se implementen correctamente, agregar validación aquí
      }

      const missingFields = [...missingAlways, ...missingNative, ...missingConditional];
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
    }

        return Response.json({ error: "Action not found" }, { status: 404 });
  } catch (error) {
    console.error("Error in customers loader:", error);
        return Response.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
};

export const action = async ({ request, params }) => {
  try {
    const auth = await authenticate.public.appProxy(request);
    
    if (!auth.admin) {
      return Response.json({ error: "App not installed or session not available" }, { status: 401 });
    }

    const { admin } = auth;
    const action = params["*"];

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json();
    console.log('[DEBUG PHONE API] Datos recibidos en API:', JSON.stringify(body, null, 2));
    console.log('[DEBUG PHONE API] Valor de phone en body:', body.phone);
    const pets = Array.isArray(body.pets) ? body.pets.filter(Boolean) : [];
    
    // Mapear document_number a tax_id si existe (para compatibilidad con metafields exchanger)
    if (body.document_number && !body.tax_id) {
      body.tax_id = body.document_number;
    }
    
    const validation = validateCustomerData(body);
    
    console.log('[DEBUG PHONE API] Resultado de validación:', JSON.stringify(validation, null, 2));

    if (!validation.valid) {
      console.log('[DEBUG PHONE API] ERROR: Validación falló. Errores:', validation.errors);
      return Response.json({ error: validation.errors.join(", ") }, { status: 400 });
    }

    if (action === "create") {
      // Construir metafields exchanger (ya existen, solo asignar valores)
      const metafields = [
        {
          namespace: "exchanger",
          key: "ex_birthday",
          type: "date",
          value: body.birth_date,
        },
        {
          namespace: "exchanger",
          key: "ex_gender",
          type: "single_line_text_field",
          value: body.gender,
        },
        {
          namespace: "exchanger",
          key: "ex_phone",
          type: "single_line_text_field",
          value: body.phone, // Ya viene sin guiones del frontend
        },
        {
          namespace: "exchanger",
          key: "ex_customer_type",
          type: "single_line_text_field",
          value: body.customer_type,
        },
      ];

      if (pets.length > 0) {
        metafields.push({
          namespace: "exchanger",
          key: "ex_segmentation",
          type: "list.single_line_text_field",
          value: JSON.stringify(pets),
        });
      }

      // Agregar campos condicionales según tipo de cliente
      if (body.customer_type === "01" || body.customer_type === "02" || body.customer_type === "04") {
        // Usar document_number si existe, de lo contrario usar tax_id
        const taxIdValue = body.document_number || body.tax_id;
        if (taxIdValue) {
          metafields.push({
            namespace: "exchanger",
            key: "ex_tax_id",
            type: "single_line_text_field",
            value: taxIdValue,
          });
        }
      }

      if (body.customer_type === "01") {
        // Contribuyente
        if (body.customer_dv) {
          metafields.push({
            namespace: "exchanger",
            key: "ex_customer_dv",
            type: "single_line_text_field",
            value: body.customer_dv,
          });
        }
        if (body.taxpayer_name) {
          metafields.push({
            namespace: "exchanger",
            key: "ex_taxpayer_name",
            type: "single_line_text_field",
            value: body.taxpayer_name,
          });
        }
        if (body.taxpayer_kind) {
          metafields.push({
            namespace: "exchanger",
            key: "ex_taxpayer_kind",
            type: "single_line_text_field",
            value: body.taxpayer_kind,
          });
        }
      } else if (body.customer_type === "02") {
        // Consumidor final
        if (body.taxpayer_name) {
          metafields.push({
            namespace: "exchanger",
            key: "ex_taxpayer_name",
            type: "single_line_text_field",
            value: body.taxpayer_name,
          });
        }
        if (body.taxpayer_kind) {
          metafields.push({
            namespace: "exchanger",
            key: "ex_taxpayer_kind",
            type: "single_line_text_field",
            value: body.taxpayer_kind,
          });
        }
      }

      if (body.location_code) {
        metafields.push({
          namespace: "exchanger",
          key: "ex_customer_location_code",
          type: "single_line_text_field",
          value: body.location_code,
        });
      }

      const createCustomerMutation = `
        mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
              email
              firstName
              lastName
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
        // phone NO se guarda en el campo nativo, solo en el metafield exchanger.ex_phone
        metafields: metafields,
      };

      console.log('[DEBUG PHONE API] customerInput antes de GraphQL:', JSON.stringify(customerInput, null, 2));
      console.log('[DEBUG PHONE API] Valor de phone en customerInput:', customerInput.phone);

      const response = await admin.graphql(createCustomerMutation, {
        variables: {
          input: customerInput,
        },
      });

      const responseData = await response.json();
      console.log('[DEBUG PHONE API] Respuesta completa de GraphQL:', JSON.stringify(responseData, null, 2));

      if (responseData.data.customerCreate.userErrors.length > 0) {
        console.log('[DEBUG PHONE API] ERROR: GraphQL userErrors encontrados:', responseData.data.customerCreate.userErrors);
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
    }

    if (action === "update") {
      if (!body.customer_id) {
        return Response.json({ error: "Customer ID is required" }, { status: 400 });
      }

      // Convertir el ID al formato GraphQL de Shopify si es necesario
      let customerId = body.customer_id;
      if (!customerId.startsWith("gid://")) {
        const numericId = customerId.replace(/\D/g, "");
        if (numericId) {
          customerId = `gid://shopify/Customer/${numericId}`;
        } else {
          return Response.json({ error: "Invalid customer ID format" }, { status: 400 });
        }
      }

      const getCustomerQuery = `
        query getCustomer($id: ID!) {
          customer(id: $id) {
            id
            email
            metafields(first: 20, namespace: "exchanger") {
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
          id: customerId,
        },
      });

      const customerData = await customerResponse.json();

      if (!customerData.data.customer) {
        return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
      }

      const existingMetafields = customerData.data.customer.metafields.edges.map(
        (edge) => edge.node
      );
      const existingByKey = {};
      existingMetafields.forEach((mf) => {
        existingByKey[mf.key] = mf;
      });

      const existingTaxId = existingMetafields.find(
        (mf) => mf.key === "ex_tax_id"
      )?.value;
      const existingCustomerType = existingMetafields.find(
        (mf) => mf.key === "ex_customer_type"
      )?.value;
      const pets = Array.isArray(body.pets) ? body.pets.filter(Boolean) : [];

      const existingEmail = customerData.data.customer.email;

      // Validar que el tax_id/document_number no cambie si ya existe
      // NO permitimos cambio del tax_id una vez asignado (es llave para integración externa)
      const taxIdValue = body.document_number || body.tax_id;
      if (existingTaxId && taxIdValue && taxIdValue !== existingTaxId) {
        return Response.json(
          { error: "El número de identificación no puede ser modificado" },
          { status: 400 }
        );
      }

      // Validar que "Resides en Panamá" no cambie si ya está guardado
      const newCustomerType = body.customer_type;
      if (
        existingCustomerType &&
        newCustomerType &&
        existingCustomerType !== newCustomerType
      ) {
        // Si cambia de 01/02 (Panamá) a 04 (Extranjero) o viceversa, no permitir
        const wasPanama = existingCustomerType === "01" || existingCustomerType === "02";
        const isPanama = newCustomerType === "01" || newCustomerType === "02";
        if (wasPanama !== isPanama) {
          return Response.json(
            { error: "No se puede cambiar si resides en Panamá o no" },
            { status: 400 }
          );
        }
      }

      if (body.email !== existingEmail) {
        return Response.json(
          { error: "El email no puede ser modificado" },
          { status: 400 }
        );
      }

      // Construir metafields exchanger (ya existen, solo asignar valores)
      const metafieldsToSet = [
        {
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_birthday",
          type: "date",
          value: body.birth_date,
        },
        {
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_gender",
          type: "single_line_text_field",
          value: body.gender,
        },
        {
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_phone",
          type: "single_line_text_field",
          value: body.phone, // Ya viene sin guiones del frontend
        },
        {
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_customer_type",
          type: "single_line_text_field",
          value: body.customer_type,
        },
      ];
      const metafieldsKeysToDelete = [];

      if (pets.length > 0) {
        metafieldsToSet.push({
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_segmentation",
          type: "list.single_line_text_field",
          value: JSON.stringify(pets),
        });
      } else if (existingByKey["ex_segmentation"]?.id) {
        metafieldsKeysToDelete.push("ex_segmentation");
      }

      // Agregar campos condicionales según tipo de cliente
      // Siempre seteamos los metafields relevantes para limpiar los que no aplican
      const taxIdValueUpdated = body.document_number || body.tax_id || "";
      if (taxIdValueUpdated) {
        metafieldsToSet.push({
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_tax_id",
          type: "single_line_text_field",
          value: taxIdValueUpdated,
        });
      } else if (existingByKey["ex_tax_id"]?.id) {
        metafieldsKeysToDelete.push("ex_tax_id");
      }

      if (body.customer_type === "01") {
        // Contribuyente
        if (body.customer_dv) {
          metafieldsToSet.push({
            ownerId: customerId,
            namespace: "exchanger",
            key: "ex_customer_dv",
            type: "single_line_text_field",
            value: body.customer_dv,
          });
        } else if (existingByKey["ex_customer_dv"]?.id) {
          metafieldsKeysToDelete.push("ex_customer_dv");
        }
        metafieldsToSet.push({
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_taxpayer_name",
          type: "single_line_text_field",
          value: body.taxpayer_name || "",
        });
        metafieldsToSet.push({
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_taxpayer_kind",
          type: "single_line_text_field",
          value: body.taxpayer_kind || "",
        });
      } else if (body.customer_type === "02") {
        // Consumidor final (limpiar campos de contribuyente)
        if (existingByKey["ex_customer_dv"]?.id) {
          metafieldsKeysToDelete.push("ex_customer_dv");
        }
        metafieldsToSet.push({
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_taxpayer_name",
          type: "single_line_text_field",
          value: body.taxpayer_name || "",
        });
        metafieldsToSet.push({
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_taxpayer_kind",
          type: "single_line_text_field",
          value: body.taxpayer_kind || "",
        });
      } else {
        // Otros tipos: limpiar campos que no aplican
        if (existingByKey["ex_customer_dv"]?.id) {
          metafieldsKeysToDelete.push("ex_customer_dv");
        }
        if (existingByKey["ex_taxpayer_name"]?.id) {
          metafieldsKeysToDelete.push("ex_taxpayer_name");
        }
        if (existingByKey["ex_taxpayer_kind"]?.id) {
          metafieldsKeysToDelete.push("ex_taxpayer_kind");
        }
      }

      // Siempre manejar location_code: set si viene valor, borrar si viene vacío
      if (body.location_code) {
        metafieldsToSet.push({
          ownerId: customerId,
          namespace: "exchanger",
          key: "ex_customer_location_code",
          type: "single_line_text_field",
          value: body.location_code,
        });
      } else if (existingByKey["ex_customer_location_code"]?.id) {
        metafieldsKeysToDelete.push("ex_customer_location_code");
      }

      const updateCustomerMutation = `
        mutation customerUpdate($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
              email
              firstName
              lastName
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const customerInput = {
        id: customerId,
        firstName: body.first_name,
        lastName: body.last_name,
        // phone NO se guarda en el campo nativo, solo en el metafield exchanger.ex_phone
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

      // Mutación para setear metafields
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

      // Borrar metafields que deben limpiarse (bulk por owner/namespace/key)
      if (metafieldsKeysToDelete.length > 0) {
        const metafieldsDeleteMutation = `
          mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
            metafieldsDelete(metafields: $metafields) {
              deletedMetafields {
                ownerId
                namespace
                key
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const metafieldsDeleteInput = metafieldsKeysToDelete.map((key) => ({
          ownerId: customerId,
          namespace: "exchanger",
          key,
        }));

        try {
          const deleteResp = await admin.graphql(metafieldsDeleteMutation, {
            variables: {
              metafields: metafieldsDeleteInput,
            },
          });
          const deleteData = await deleteResp.json();
          if (
            deleteData.data.metafieldsDelete.userErrors &&
            deleteData.data.metafieldsDelete.userErrors.length > 0
          ) {
            const errors = deleteData.data.metafieldsDelete.userErrors
              .map((err) => err.message)
              .join(", ");
            console.warn("No se pudo limpiar algunos metafields:", errors);
          }
        } catch (err) {
          console.warn("Error eliminando metafields (continuando):", err);
        }
      }

      return Response.json({
        success: true,
        customer: updateData.data.customerUpdate.customer,
      });
    }

        return Response.json({ error: "Action not found" }, { status: 404 });
  } catch (error) {
    console.error("Error in customers action:", error);
        return Response.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
};

