import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const publishableKey =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const allowedOrigin = Deno.env.get("ADMIN_ALLOWED_ORIGIN") ?? "";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
let serviceClient: ReturnType<typeof createClient> | null = null;
let verificationClient: ReturnType<typeof createClient> | null = null;

function getServiceClient() {
  if (!serviceClient) {
    throw new Error("The service client is not initialized.");
  }
  return serviceClient;
}

function respond(body: Record<string, unknown>, status: number, origin: string | null) {
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json");
  if (origin && allowedOrigin && origin === allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function listAll(bucket: string, prefix: string) {
  const objects: Array<{ name: string; id: string | null }> = [];
  const storage = getServiceClient().storage;
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`Storage listing failed for ${bucket}: ${error.message}`);
    }
    objects.push(...(data ?? []).map(({ name, id }) => ({ name, id })));
    if (!data || data.length < pageSize) {
      return objects;
    }
  }
}

async function removeObjects(bucket: string, paths: string[]) {
  const storage = getServiceClient().storage;
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await storage
      .from(bucket)
      .remove(paths.slice(offset, offset + 100));
    if (error) {
      throw new Error(`Storage cleanup failed for ${bucket}: ${error.message}`);
    }
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin && (!allowedOrigin || origin !== allowedOrigin)) {
    return respond({ error: "Origin is not allowed." }, 403, origin);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
      },
    });
  }
  if (request.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405, origin);
  }
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !allowedOrigin) {
    return respond({ error: "The deletion function is not configured." }, 503, origin);
  }
  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    verificationClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  const adminClient = getServiceClient();
  if (!verificationClient) {
    return respond({ error: "Token verification is not configured." }, 503, origin);
  }
  const tokenClient = verificationClient;

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return respond({ error: "Authentication is required." }, 401, origin);
  }

  try {
    const { data: claimsData, error: claimsError } = await tokenClient.auth.getClaims(accessToken);
    if (claimsError || !claimsData?.claims?.sub) {
      return respond({ error: "The access token is invalid or expired." }, 401, origin);
    }
    if (claimsData.claims.aal !== "aal2") {
      return respond({ error: "A verified AAL2 session is required." }, 403, origin);
    }

    const actorId = String(claimsData.claims.sub);
    const { data: actor, error: actorError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", actorId)
      .maybeSingle();
    if (actorError) {
      throw actorError;
    }
    if (actor?.role !== "admin") {
      return respond({ error: "Administrator access is required." }, 403, origin);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return respond({ error: "A JSON request body is required." }, 400, origin);
    }
    const farmerId =
      typeof body === "object" && body !== null && "farmer_id" in body
        ? body.farmer_id
        : null;
    if (typeof farmerId !== "string" || !uuidPattern.test(farmerId)) {
      return respond({ error: "A valid farmer account ID is required." }, 400, origin);
    }
    if (farmerId === actorId) {
      return respond({ error: "An administrator cannot delete their own account here." }, 400, origin);
    }

    const { data: farmer, error: farmerError } = await adminClient
      .from("farmer_profiles")
      .select("id,farm_name,status")
      .eq("id", farmerId)
      .maybeSingle();
    if (farmerError) {
      throw farmerError;
    }
    if (!farmer) {
      return respond({ error: "The farmer account no longer exists." }, 404, origin);
    }

    const [photoFolders, documents] = await Promise.all([
      listAll("listing-photos", farmerId),
      listAll("farmer-documents", farmerId),
    ]);
    const photoPaths: string[] = [];
    for (const folder of photoFolders.filter((item) => item.id === null)) {
      const files = await listAll("listing-photos", `${farmerId}/${folder.name}`);
      photoPaths.push(
        ...files
          .filter((file) => file.id !== null)
          .map((file) => `${farmerId}/${folder.name}/${file.name}`),
      );
    }
    const documentPaths = documents
      .filter((item) => item.id !== null)
      .map((item) => `${farmerId}/${item.name}`);

    const { error: auditError } = await adminClient.from("activity_logs").insert({
      actor_id: actorId,
      action: "farmer.deleted",
      target_type: "farmer_profile",
      target_id: farmerId,
      details: { farm_name: farmer.farm_name, storage_object_count: photoPaths.length + documentPaths.length },
    });
    if (auditError) {
      throw new Error(`Deletion was stopped because its audit entry could not be written: ${auditError.message}`);
    }

    await removeObjects("listing-photos", photoPaths);
    await removeObjects("farmer-documents", documentPaths);

    const { error: listingsError } = await adminClient
      .from("listings")
      .delete()
      .eq("farmer_id", farmerId);
    if (listingsError) {
      throw new Error(`Storage was cleaned, but the farmer's listings could not be deleted: ${listingsError.message}`);
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(farmerId);
    if (deleteUserError) {
      throw new Error(`Storage and listings were removed, but the Auth account could not be deleted: ${deleteUserError.message}`);
    }

    return respond({ message: `Le compte de ${farmer.farm_name} et ses données ont été supprimés.` }, 200, origin);
  } catch (error) {
    console.error("admin-delete-farmer failed", error);
    return respond({ error: "The farmer account could not be fully deleted. Check the function logs before retrying." }, 500, origin);
  }
});
