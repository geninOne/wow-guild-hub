/** Führt einen Lauf aus, loggt den Bericht als eine JSON-Zeile und gibt ihn zurück. Fehler nur mit ihrer Meldung. */
export async function runAndRespond(name: string, job: () => Promise<unknown>): Promise<Response> {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  try {
    const report = await job();
    console.log(JSON.stringify({ job: name, ...(report as object) }));
    return new Response(JSON.stringify(report), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    console.error(JSON.stringify({ job: name, error: message }));
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
}
