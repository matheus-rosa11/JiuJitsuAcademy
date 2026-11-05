import assert from "node:assert/strict";
import test from "node:test";
import { absenceWarning, chooseInstructor, matchedInstructors, nextInstructor, photoRoll, presenceUpdates } from "./classPhoto.ts";

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

test("a sure match is marked present and a missed classmate is not a question", () => {
  const roll = photoRoll(
    [
      { studentId: "ana", status: "suggested", reason: "matched" },
      { studentId: "bruno", status: "pending", reason: "not_seen" },
      { studentId: "carla", status: "pending", reason: "no_profile" },
    ],
    [
      { role: "suggested", studentId: "ana" },
      { role: "unknown", studentId: null },
    ],
  );
  assert.deepEqual(roll.present, { ana: true });
  assert.equal(roll.reading.ana, "recognized");
  assert.equal(roll.reading.bruno, "missing");
  assert.equal(roll.reading.carla, "no_profile");
  assert.equal(roll.unknownFaces, 1);
});

test("two profiles of the same person stay in review and are not marked present", () => {
  const roll = photoRoll(
    [
      { studentId: "andre", status: "review", reason: "needs_review" },
      { studentId: "matheus", status: "pending", reason: "not_seen" },
    ],
    [
      {
        role: "review",
        studentId: "andre",
        ambiguous: true,
        candidates: [
          { studentId: "andre", decision: "MATCHED" },
          { studentId: "matheus", decision: "MATCHED" },
        ],
      },
    ],
  );
  assert.deepEqual(roll.present, {});
  assert.equal(roll.reading.andre, "review");
  assert.equal(roll.reading.matheus, "review");
});

test("two faces for one student are not applied as presence", () => {
  const roll = photoRoll(
    [{ studentId: "ana", status: "suggested", reason: "matched" }],
    [
      { role: "suggested", studentId: "ana" },
      { role: "suggested", studentId: "ana" },
    ],
  );
  assert.deepEqual(roll.present, {});
  assert.equal(roll.reading.ana, "review");
});

test("an instructor face is not an unknown and is not marked present", () => {
  const roll = photoRoll(
    [{ studentId: "ana", status: "suggested", reason: "matched" }],
    [
      { role: "instructor", studentId: "giba" },
      { role: "suggested", studentId: "ana" },
    ],
  );
  assert.deepEqual(roll.present, { ana: true });
  assert.equal(roll.unknownFaces, 0);
  assert.equal(roll.reading.giba, undefined);
});

test("the principal is the instructor, otherwise the highest belt and degree", () => {
  const professors = [
    { id: "roxo", name: "Rafael Costa", beltOrder: 3, degree: 1, isPrincipal: false },
    { id: "marrom", name: "Felipe Rocha", beltOrder: 4, degree: 0, isPrincipal: false },
    { id: "giba", name: "Giba", beltOrder: 5, degree: 0, isPrincipal: true },
  ];
  const withPrincipal = [
    { role: "suggested", studentId: "marrom" },
    { role: "instructor", studentId: "giba" },
    { role: "review", studentId: "roxo" },
  ];
  assert.equal(chooseInstructor(professors, withPrincipal), "giba");
  assert.deepEqual(
    matchedInstructors(professors, withPrincipal).map((professor) => professor.id),
    ["giba", "marrom"],
  );
  assert.equal(
    chooseInstructor(professors, [
      { role: "suggested", studentId: "roxo" },
      { role: "instructor", studentId: "marrom" },
    ]),
    "marrom",
  );
  assert.equal(
    chooseInstructor(
      [
        { id: "a", name: "Ana", beltOrder: 4, degree: 1, isPrincipal: false },
        { id: "b", name: "Bruno", beltOrder: 4, degree: 3, isPrincipal: false },
      ],
      [
        { role: "suggested", studentId: "a" },
        { role: "instructor", studentId: "b" },
      ],
    ),
    "b",
  );
  assert.equal(chooseInstructor(professors, [{ role: "review", studentId: "giba" }]), null);
  assert.equal(nextInstructor(["giba", "marrom"], "giba"), "marrom");
  assert.equal(nextInstructor(["giba", "marrom"], "marrom"), "giba");
});

test("saving after a photo warns that unmarked students would be recorded absent", () => {
  assert.equal(absenceWarning([]), null);
  assert.match(absenceWarning(["Ana"]), /este aluno como ausente: Ana/);
  assert.match(absenceWarning(["Ana", "Bruno"]), /estes alunos como ausentes: Ana, Bruno/);
  const many = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  assert.match(absenceWarning(many) ?? "", /e mais 1/);
});
