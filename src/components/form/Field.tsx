import type { FormState } from "@/lib/forms";

type Common = {
  name: string;
  label: string;
  state: FormState;
  /** Value to show when the form first loads (e.g. when editing). */
  initial?: string | number | null;
  hint?: string;
};

type InputProps = Common & {
  as?: "input";
  type?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: "text" | "tel" | "email" | "url";
  autoComplete?: string;
};
type TextareaProps = Common & { as: "textarea"; placeholder?: string };
type SelectProps = Common & { as: "select"; options: { value: string; label: string }[] };

/** Label + input/textarea/select + error message, wired to a FormState. */
export function Field(props: InputProps | TextareaProps | SelectProps) {
  const { name, label, state, initial, hint } = props;
  const error = state.errors?.[name];
  const value = state.values?.[name] ?? (initial == null ? "" : String(initial));
  const id = `f-${name}`;
  const common = {
    id,
    name,
    defaultValue: value,
    className: "input",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  };

  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {props.as === "textarea" ? (
        <textarea {...common} placeholder={props.placeholder} />
      ) : props.as === "select" ? (
        <select {...common}>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={props.type ?? "text"}
          placeholder={props.placeholder}
          required={props.required}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete ?? "off"}
        />
      )}
      {error ? (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      ) : (
        hint && <span className="label">{hint}</span>
      )}
    </div>
  );
}
