"use client";

export default function DeleteProjectButton({
  projectId,
  deleteAction,
}: {
  projectId: string;
  deleteAction: (formData: FormData) => void;
}) {
  return (
    <form
      action={deleteAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Delete this project? This also deletes its leaders, sessions, messages, and synthesis. This cannot be undone."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        className="text-sm text-red-600 hover:underline"
      >
        Delete
      </button>
    </form>
  );
}
