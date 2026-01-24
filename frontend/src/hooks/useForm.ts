import { useState } from 'react';

export type Validator<T> = (values: T) => Partial<Record<keyof T, string>>;

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validate?: Validator<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof T]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name as keyof T];
        return next;
      });
    }
  };

  const handleSubmit = (onSubmit: (values: T) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) return;
    }
    onSubmit(values);
  };

  const reset = (next?: Partial<T>) => setValues((prev) => ({ ...prev, ...next } as T));

  return { values, errors, handleChange, handleSubmit, reset, setValues, setErrors };
}

export default useForm;
