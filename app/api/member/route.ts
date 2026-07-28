import {
  createMember,
  hashPin,
  loadMember,
  publicMember,
  saveMember,
} from "../storage";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      pin?: string;
      memberName?: string;
    };
    const pin = payload.pin?.trim() ?? "";
    const memberName = payload.memberName?.trim() ?? "";

    if (pin.length < 4) {
      return Response.json({ error: "PIN must be at least 4 characters." }, { status: 400 });
    }

    const pinHash = await hashPin(pin);
    const existing = await loadMember(pinHash);
    if (existing) {
      if (memberName && existing.memberName === "Member") {
        existing.memberName = memberName;
        await saveMember(existing);
      }
      return Response.json({ created: false, member: publicMember(existing) });
    }

    const member = createMember(pinHash, memberName);
    await saveMember(member);
    return Response.json({ created: true, member: publicMember(member) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to open member profile.";
    return Response.json({ error: message }, { status: 500 });
  }
}
