"use client";

import { useState, useEffect, useRef } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Database,
  Globe,
  Calculator,
  FileText,
  Microscope,
  Lightbulb,
  Trash2,
  ExternalLink,
  BookOpen,
  Sparkles,
  Edit3,
  GraduationCap,
  PenTool,
  Save,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useGlobal } from "@/context/GlobalContext";
import { apiUrl } from "@/lib/api";
import { processLatexContent } from "@/lib/latex";
import AddToNotebookModal from "@/components/AddToNotebookModal";
import { useTranslation } from "react-i18next";

interface KnowledgeBase {
  name: string;
  is_default?: boolean;
}

export default function HomePage() {
  const {
    chatState,
    setChatState,
    sendChatMessage,
    clearChatHistory,
    newChatSession,
  } = useGlobal();
  const { t } = useTranslation();

  const [inputMessage, setInputMessage] = useState("");
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showNotebookModal, setShowNotebookModal] = useState(false);

  // Format chat history for notebook
  const formatChatForNotebook = () => {
    if (chatState.messages.length === 0)
      return { title: "", userQuery: "", output: "" };

    // Use the first user message as title
    const firstUserMsg = chatState.messages.find((m) => m.role === "user");
    const title =
      firstUserMsg?.content.slice(0, 50) +
        (firstUserMsg && firstUserMsg.content.length > 50 ? "..." : "") ||
      t("Chat Session");

    // Format all messages as markdown
    const formattedMessages = chatState.messages
      .map((msg, idx) => {
        const roleLabel =
          msg.role === "user"
            ? `👤 **${t("User")}**`
            : `🤖 **${t("Assistant")}**`;
        return `### ${roleLabel}\n\n${msg.content}`;
      })
      .join("\n\n---\n\n");

    // User query is the concatenation of all user messages
    const userQueries = chatState.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n\n");

    return {
      title: `Chat: ${title}`,
      userQuery: userQueries,
      output: formattedMessages,
    };
  };

  // Fetch knowledge bases
  useEffect(() => {
    fetch(apiUrl("/api/v1/knowledge/list"))
      .then((res) => res.json())
      .then((data) => {
        // Ensure data is an array before processing
        const kbList = Array.isArray(data) ? data : [];
        setKbs(kbList);
        if (!chatState.selectedKb && kbList.length > 0) {
          const defaultKb = kbList.find((kb: KnowledgeBase) => kb.is_default);
          if (defaultKb) {
            setChatState((prev) => ({ ...prev, selectedKb: defaultKb.name }));
          } else {
            setChatState((prev) => ({ ...prev, selectedKb: kbList[0].name }));
          }
        }
      })
      .catch((err) => console.error("Failed to fetch KBs:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Use scrollTop instead of scrollIntoView to prevent page-level scrolling
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatState.messages]);

  const handleSend = () => {
    if (!inputMessage.trim() || chatState.isLoading) return;
    sendChatMessage(inputMessage);
    setInputMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    {
      icon: Calculator,
      label: t("Smart Problem Solving"),
      href: "/solver",
      description: t("Multi-agent reasoning"),
    },
    {
      icon: PenTool,
      label: t("Generate Practice Questions"),
      href: "/question",
      description: t("Auto-validated quizzes"),
    },
    {
      icon: Microscope,
      label: t("Deep Research Reports"),
      href: "/research",
      description: t("Comprehensive analysis"),
    },
    {
      icon: Lightbulb,
      label: t("Generate Novel Ideas"),
      href: "/ideagen",
      description: t("Brainstorm & synthesize"),
    },
    {
      icon: GraduationCap,
      label: t("Guided Learning"),
      href: "/guide",
      description: t("Learn through notebook or course handout upload"),
    },
    {
      icon: Edit3,
      label: t("Co-Writer"),
      href: "/co_writer",
      description: t("Collaborative writing"),
    },
  ];

  const hasMessages = chatState.messages.length > 0;

  return (
    <div className="h-screen flex flex-col animate-fade-in">
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h1 className="text-4xl font-bold text-white mb-3 tracking-tight drop-shadow">
              {t("Welcome to LIS")}
            </h1>
            <p className="text-lg text-white/70">
              {t("How can I help you today?")}
            </p>
          </div>

          {/* Input Box - Centered */}
          <div className="w-full max-w-2xl mx-auto mb-12">
            {/* Mode Toggles */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                {/* RAG Toggle */}
                <button
                  onClick={() =>
                    setChatState((prev) => ({
                      ...prev,
                      enableRag: !prev.enableRag,
                    }))
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    chatState.enableRag
                      ? "bg-white/30 text-white border border-white/40"
                      : "bg-white/10 text-white/60 border border-white/20 hover:bg-white/20"
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  {t("RAG")}
                </button>

                {/* Web Search Toggle */}
                <button
                  onClick={() =>
                    setChatState((prev) => ({
                      ...prev,
                      enableWebSearch: !prev.enableWebSearch,
                    }))
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    chatState.enableWebSearch
                      ? "bg-white/30 text-white border border-white/40"
                      : "bg-white/10 text-white/60 border border-white/20 hover:bg-white/20"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {t("Web Search")}
                </button>
              </div>

              {/* KB Selector */}
              {chatState.enableRag && (
                <select
                  value={chatState.selectedKb}
                  onChange={(e) =>
                    setChatState((prev) => ({
                      ...prev,
                      selectedKb: e.target.value,
                    }))
                  }
                  className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 outline-none focus:border-green-400 dark:text-slate-200"
                >
                  {kbs.map((kb) => (
                    <option key={kb.name} value={kb.name}>
                      {kb.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Input Field */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                className="w-full px-5 py-4 pr-14 bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/50 transition-all placeholder:text-white/50 text-white shadow-lg"
                placeholder={t("Ask anything...")}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatState.isLoading}
              />
              <button
                onClick={handleSend}
                disabled={chatState.isLoading || !inputMessage.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-white/30 backdrop-blur-sm text-white rounded-xl flex items-center justify-center hover:bg-white/40 disabled:opacity-40 transition-all"
              >
                {chatState.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="w-full max-w-3xl mx-auto">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 text-center">
              {t("Explore Modules")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {quickActions.map((action, i) => (
                <Link
                  key={i}
                  href={action.href}
                  className="group p-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 hover:shadow-lg transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-white/30 transition-all">
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-1">
                    {action.label}
                  </h4>
                  <p className="text-xs text-white/60">
                    {action.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat Interface - When there are messages */}
      {hasMessages && (
        <>
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/10 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {/* Mode Toggles */}
              <button
                onClick={() =>
                  setChatState((prev) => ({
                    ...prev,
                    enableRag: !prev.enableRag,
                  }))
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  chatState.enableRag
                    ? "bg-white/30 text-white"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                <Database className="w-3 h-3" />
                {t("RAG")}
              </button>

              <button
                onClick={() =>
                  setChatState((prev) => ({
                    ...prev,
                    enableWebSearch: !prev.enableWebSearch,
                  }))
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  chatState.enableWebSearch
                    ? "bg-white/30 text-white"
                    : "bg-white/10 text-white/60 hover:bg-white/20"
                }`}
              >
                <Globe className="w-3 h-3" />
                {t("Web Search")}
              </button>

              {chatState.enableRag && (
                <select
                  value={chatState.selectedKb}
                  onChange={(e) =>
                    setChatState((prev) => ({
                      ...prev,
                      selectedKb: e.target.value,
                    }))
                  }
                  className="text-xs bg-slate-100 dark:bg-slate-800 border-0 rounded-lg px-2 py-1 outline-none dark:text-slate-200"
                >
                  {kbs.map((kb) => (
                    <option key={kb.name} value={kb.name}>
                      {kb.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNotebookModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={t("Save to Notebook")}
              >
                <Save className="w-3.5 h-3.5" />
                {t("Save to Notebook")}
              </button>
              <button
                onClick={newChatSession}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t("New Chat")}
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
          >
            {chatState.messages.map((msg, idx) => (
              <div
                key={idx}
                className="flex gap-4 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2"
              >
                {msg.role === "user" ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 bg-white/15 backdrop-blur-sm px-4 py-3 rounded-2xl rounded-tl-none text-white border border-white/20">
                      {msg.content}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center shrink-0 shadow-lg shadow-green-500/30">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="bg-white/15 backdrop-blur-sm px-5 py-4 rounded-2xl rounded-tl-none border border-white/20 shadow-sm">
                        <div className="prose prose-invert prose-sm max-w-none text-white">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {processLatexContent(msg.content)}
                          </ReactMarkdown>
                        </div>

                        {/* Loading indicator */}
                        {msg.isStreaming && (
                          <div className="flex items-center gap-2 mt-3 text-green-600 dark:text-green-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t("Generating response...")}</span>
                          </div>
                        )}
                      </div>

                      {/* Sources */}
                      {msg.sources &&
                        (msg.sources.rag?.length ?? 0) +
                          (msg.sources.web?.length ?? 0) >
                          0 && (
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.rag?.map((source, i) => (
                              <div
                                key={`rag-${i}`}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>{source.kb_name}</span>
                              </div>
                            ))}
                            {msg.sources.web?.slice(0, 3).map((source, i) => (
                              <a
                                key={`web-${i}`}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                              >
                                <Globe className="w-3 h-3" />
                                <span className="max-w-[150px] truncate">
                                  {source.title || source.url}
                                </span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        )}
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Status indicator */}
            {chatState.isLoading && chatState.currentStage && (
              <div className="flex gap-4 w-full max-w-4xl mx-auto">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    {chatState.currentStage === "rag" &&
                      t("Searching knowledge base...")}
                    {chatState.currentStage === "web" &&
                      t("Searching the web...")}
                    {chatState.currentStage === "generating" &&
                      t("Generating response...")}
                    {!["rag", "web", "generating"].includes(
                      chatState.currentStage,
                    ) && chatState.currentStage}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="border-t border-white/10 bg-black/10 backdrop-blur-sm px-6 py-4">
            <div className="max-w-4xl mx-auto relative">
              <input
                ref={inputRef}
                type="text"
                className="w-full px-5 py-3.5 pr-14 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/40 transition-all placeholder:text-white/40 text-white"
                placeholder={t("Type your message...")}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatState.isLoading}
              />
              <button
                onClick={handleSend}
                disabled={chatState.isLoading || !inputMessage.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-white/25 text-white rounded-lg flex items-center justify-center hover:bg-white/35 disabled:opacity-40 transition-all"
              >
                {chatState.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add to Notebook Modal */}
      <AddToNotebookModal
        isOpen={showNotebookModal}
        onClose={() => setShowNotebookModal(false)}
        recordType="chat"
        title={formatChatForNotebook().title}
        userQuery={formatChatForNotebook().userQuery}
        output={formatChatForNotebook().output}
        metadata={{
          session_id: chatState.sessionId,
          message_count: chatState.messages.length,
          enable_rag: chatState.enableRag,
          enable_web_search: chatState.enableWebSearch,
        }}
        kbName={chatState.enableRag ? chatState.selectedKb : undefined}
      />
    </div>
  );
}
