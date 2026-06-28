export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

export const isBlank = (value: string) => value.trim().length === 0;

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const validateRequiredText = (value: string, label: string, minLength = 1) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return `${label} is required.`;
  }

  if (trimmedValue.length < minLength) {
    return `${label} must be at least ${minLength} characters.`;
  }

  return null;
};

export const validateCoordinate = (value: string, label: "Latitude" | "Longitude") => {
  if (isBlank(value)) {
    return `${label} is required.`;
  }

  const numberValue = Number(value);
  const min = label === "Latitude" ? -90 : -180;
  const max = label === "Latitude" ? 90 : 180;

  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    return `${label} must be between ${min} and ${max}.`;
  }

  return null;
};

export const validateOptionalImageFile = (file: File | null, label = "Photo") => {
  if (!file) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    return `${label} must be an image file.`;
  }

  if (file.size > 5 * 1024 * 1024) {
    return `${label} must be under 5 MB.`;
  }

  return null;
};

export const validateDateOrder = (start: string, end: string, startLabel = "Scheduled date", endLabel = "Due date") => {
  if (!start || !end) {
    return null;
  }

  if (new Date(end).getTime() < new Date(start).getTime()) {
    return `${endLabel} cannot be before ${startLabel.toLowerCase()}.`;
  }

  return null;
};
