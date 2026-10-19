/** Typed helpers for `Request.formData()` in Next.js route handlers. */
export type RequestFormData = Awaited<ReturnType<Request["formData"]>>;

type FormDataWithGet = {
  get(name: string): FormDataEntryValue | null;
};

function asReadableForm(form: RequestFormData): FormDataWithGet {
  return form as unknown as FormDataWithGet;
}

export function getFormField(
  form: RequestFormData,
  name: string
): FormDataEntryValue | null {
  return asReadableForm(form).get(name);
}

export function getFormString(form: RequestFormData, name: string): string {
  return String(getFormField(form, name) ?? "");
}
