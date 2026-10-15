import assert from "node:assert/strict";
import test from "node:test";
import { absenceWarning, presenceUpdates } from "./classPhoto.ts";

test("accepted faces become presences and a duplicate name is rejected", () => {
  const applied = presenceUpdates([
    { studentId: "ana", accepted: true },
    { studentId: "bruno", accepted: false },
    { studentId: null, accepted: true },
  ]);
  assert.deepEqual(applied, { ok: true, present: { ana: true } });
  assert.equal(JSON.stringify(applied).includes("false"), false);

  const duplicate = presenceUpdates([
    { studentId: "ana", accepted: true },
    { studentId: "ana", accepted: true },
  ]);
  assert.deepEqual(duplicate, { ok: false, message: "Dois rostos foram atribuídos à mesma pessoa." });
});

test("saving after a photo warns that unmarked students would be recorded absent", () => {
  assert.equal(absenceWarning([]), null);
  assert.match(absenceWarning(["Ana"]), /este aluno como ausente: Ana/);
  assert.match(absenceWarning(["Ana", "Bruno"]), /estes alunos como ausentes: Ana, Bruno/);
  const many = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  assert.match(absenceWarning(many) ?? "", /e mais 1/);
});
