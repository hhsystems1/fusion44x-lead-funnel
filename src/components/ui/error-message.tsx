interface ErrorMessageProps {
  message: string;
  id?: string;
}

export function ErrorMessage({ message, id }: ErrorMessageProps) {
  return (
    <div
      id={id}
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}
