"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/auth-headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, ClipboardList, ListPlus, Loader2, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";

export type QuestionnaireQuestion = {
  id: string;
  text: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function QuestionnaireView() {
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [drafts, setDrafts] = useState<Record<string, QuestionnaireQuestion>>({});
  const [newQuestion, setNewQuestion] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoringDefaults, setIsRestoringDefaults] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visibleQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => !query || question.text.toLowerCase().includes(query));
  }, [questions, search]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl("/api/questionnaire-questions"), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
        throw new Error(payload?.message || "Failed to load questionnaire questions");
      }
      setQuestions(payload.data);
      setDrafts({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load questionnaire questions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const getDraft = (question: QuestionnaireQuestion) => drafts[question.id] || question;

  const updateDraft = (question: QuestionnaireQuestion, updates: Partial<QuestionnaireQuestion>) => {
    setDrafts((current) => ({
      ...current,
      [question.id]: {
        ...(current[question.id] || question),
        ...updates,
      },
    }));
  };

  const handleCreate = async () => {
    const text = newQuestion.trim();
    if (!text) {
      toast.error("Question text is required");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(apiUrl("/api/questionnaire-questions"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to create question");
      }
      setNewQuestion("");
      await loadQuestions();
      toast.success("Question created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create question");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreDefaults = async () => {
    setIsRestoringDefaults(true);
    try {
      const response = await fetch(apiUrl("/api/questionnaire-questions/baseline"), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to restore default questions");
      }
      await loadQuestions();
      const added = typeof payload.added === "number" ? payload.added : 0;
      toast.success(added > 0 ? `Restored ${added} default question${added === 1 ? "" : "s"}` : "Default questions are already present");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore default questions");
    } finally {
      setIsRestoringDefaults(false);
    }
  };

  const handleSave = async (question: QuestionnaireQuestion) => {
    const draft = getDraft(question);
    if (!draft.text.trim()) {
      toast.error("Question text is required");
      return;
    }

    setSavingId(question.id);
    try {
      const response = await fetch(apiUrl(`/api/questionnaire-questions/${encodeURIComponent(question.id)}`), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text: draft.text.trim(), isActive: draft.isActive !== false }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to update question");
      }
      await loadQuestions();
      toast.success("Question updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update question");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (question: QuestionnaireQuestion) => {
    setDeletingId(question.id);
    try {
      const response = await fetch(apiUrl(`/api/questionnaire-questions/${encodeURIComponent(question.id)}`), {
        method: "DELETE",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to delete question");
      }
      await loadQuestions();
      toast.success("Question deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete question");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Questionnaire</h1>
          <p className="text-sm font-medium text-gray-500">
            Manage baseline medical questionnaire items shown on patient records.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleRestoreDefaults} disabled={isRestoringDefaults || isLoading} className="gap-2">
            {isRestoringDefaults ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
            Restore Defaults
          </Button>
          <Button variant="outline" onClick={loadQuestions} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-black">
            <Plus className="h-5 w-5 text-blue-600" />
            New Question
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="new-question">Question Text</Label>
              <Input
                id="new-question"
                value={newQuestion}
                onChange={(event) => setNewQuestion(event.target.value)}
                placeholder="e.g. Has the patient experienced tooth sensitivity?"
              />
            </div>
            <Button onClick={handleCreate} disabled={isCreating} className="gap-2">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              Saved Questions
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              These appear as checkboxes in the patient details questionnaire tab.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions..." className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">Box</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[180px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleQuestions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      No questions found.
                    </TableCell>
                  </TableRow>
                ) : visibleQuestions.map((question) => {
                  const draft = getDraft(question);
                  const changed =
                    draft.text !== question.text ||
                    (draft.isActive !== false) !== (question.isActive !== false);

                  return (
                    <TableRow key={question.id}>
                      <TableCell>
                        <Checkbox checked={false} disabled aria-label="Question checkbox preview" />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draft.text}
                          onChange={(event) => updateDraft(question, { text: event.target.value })}
                          className="font-semibold"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className="border-none bg-emerald-100 text-emerald-700">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant={changed ? "default" : "outline"}
                            onClick={() => handleSave(question)}
                            disabled={!changed || savingId === question.id}
                            className="gap-2"
                          >
                            {savingId === question.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : changed ? (
                              <Save className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                            {changed ? "Save" : "Saved"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(question)}
                            disabled={deletingId === question.id}
                            className="gap-2 text-red-600 hover:text-red-700"
                          >
                            {deletingId === question.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
