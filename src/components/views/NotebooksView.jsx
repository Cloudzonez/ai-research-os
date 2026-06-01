import React, { useState } from "react";
import NotebooksHomeView from "./NotebooksHomeView.jsx";
import NotebookDetailView from "./NotebookDetailView.jsx";

export default function NotebooksView(props) {
  const [activeNotebookId, setActiveNotebookId] = useState(null);

  if (activeNotebookId) {
    return (
      <NotebookDetailView
        {...props}
        notebookId={activeNotebookId}
        onBack={() => setActiveNotebookId(null)}
      />
    );
  }

  return (
    <NotebooksHomeView
      {...props}
      onOpenNotebook={(notebook) => setActiveNotebookId(notebook._id)}
    />
  );
}
