import { lazy } from "react";

// Abas pesadas ou frequentes importadas diretamente para performance
import SummaryTab from "./SummaryTab";
import PiecesTab from "./PiecesTab";
import MatrixTab from "./MatrixTab";
import BudgetTab from "./BudgetTab";

export { SummaryTab, PiecesTab, MatrixTab, BudgetTab };

// Abas leves ou raramente acessadas mantidas como lazy
export const OccurrencesTab = lazy(() => import("./OccurrencesTab"));
export const SchedulingTab = lazy(() => import("./SchedulingTab"));
export const InstallationsTab = lazy(() => import("./InstallationsTab"));
export const ApprovalsTab = lazy(() => import("./ApprovalsTab"));
export const StoresTab = lazy(() => import("./StoresTab"));
export const HistoryTab = lazy(() => import("./HistoryTab"));
export const MockupTab = lazy(() => import("./MockupTab"));
export const LojaALojaTab = lazy(() => import("./LojaALojaTab"));
export const BriefingTab = lazy(() => import("./BriefingTab"));

