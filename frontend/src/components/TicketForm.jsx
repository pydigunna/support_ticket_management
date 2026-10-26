import { useState } from "react";

const emptyForm = {
  title: "",
  description: "",
  priority: "Medium",
  category: "",
};

const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const CATEGORIES = [
  "Technical",
  "Account",
  "Billing",
  "Payment",
  "Profile",
  "Hardware",
  "Software",
  "Network",
  "Other",
];

// Keep only the editable fields (an edited ticket also carries _id, status, etc.)
const pickFormFields = (values = {}) => ({
  title: values.title ?? emptyForm.title,
  description: values.description ?? emptyForm.description,
  priority: values.priority ?? emptyForm.priority,
  category: values.category ?? emptyForm.category,
});

function TicketForm({
  onSubmit,
  onCancel,
  userName,
  mode = "create",
  initialValues = emptyForm,
}) {
  
  const [form, setForm] = useState(() => pickFormFields(initialValues));
  const [submitState, setSubmitState] = useState({ saving: false, error: "" });
  const { saving, error } = submitState;
  const isEdit = mode === "edit";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitState({ saving: true, error: "" });

    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: form.category.trim(),
      });
      if (!isEdit) setForm(emptyForm);
      setSubmitState({ saving: false, error: "" });
    } catch (err) {
      setSubmitState({
        saving: false,
        error: err.message || (isEdit ? "Unable to update ticket" : "Unable to create ticket"),
      });
    }
  };

  return (
    <form className="ticket-form" onSubmit={handleSubmit}>
      <h2>{isEdit ? "Edit Ticket" : "Create a Ticket"}</h2>
      {!isEdit && <p>Created by {userName}. Our support team will handle the assignment.</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      <label>
        Title
        <input name="title" value={form.title} onChange={handleChange} placeholder="Enter ticket title" required maxLength={150} />
      </label>

      <label>
        Description
        <textarea name="description" value={form.description} onChange={handleChange} placeholder="Describe the issue" required rows={3} />
      </label>

      <label>
        Priority
        <select name="priority" value={form.priority} onChange={handleChange}>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>{priority}</option>
          ))}
        </select>
      </label>

      <label>
        Category
        <select name="category" value={form.category} onChange={handleChange} required>
          <option value="">Select a category</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>

      <div className="form-actions">
        <button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Ticket"}</button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}

export default TicketForm;
