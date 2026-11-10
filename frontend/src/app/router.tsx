import { lazy } from "react";
import { createBrowserRouter, Link } from "react-router";
import { Layout } from "./Layout";

const Dashboard = lazy(() => import("@/modules/dashboard/Dashboard"));
const GraphPage = lazy(() => import("@/modules/graph/GraphPage"));
const ProjectilePage = lazy(() => import("@/modules/projectile/ProjectilePage"));
const CalculusPage = lazy(() => import("@/modules/calculus/CalculusPage"));
const FiniteAutomataPage = lazy(() => import("@/modules/automata/pages/FiniteAutomataPage"));
const PDAPage = lazy(() => import("@/modules/automata/pages/PDAPage"));
const TuringPage = lazy(() => import("@/modules/automata/pages/TuringPage"));
const NcertHome = lazy(() => import("@/modules/ncert/NcertHome"));
const ClassPage = lazy(() => import("@/modules/ncert/ClassPage"));
const ChapterPage = lazy(() => import("@/modules/ncert/ChapterPage"));
const LabHome = lazy(() => import("@/modules/lab/LabHome"));
const ExperimentPage = lazy(() => import("@/modules/lab/ExperimentPage"));

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-bold text-accent">404</p>
      <p className="mt-3 text-muted">This page does not exist.</p>
      <Link to="/" className="mt-5 inline-block text-sm font-medium text-accent hover:underline">
        Back to the dashboard
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "graph", Component: GraphPage },
      { path: "projectile", Component: ProjectilePage },
      { path: "calculus", Component: CalculusPage },
      { path: "automata", Component: FiniteAutomataPage },
      { path: "pda", Component: PDAPage },
      { path: "turing", Component: TuringPage },
      { path: "ncert", Component: NcertHome },
      { path: "ncert/class/:grade", Component: ClassPage },
      { path: "ncert/chapter/:chapterId/:topicId?", Component: ChapterPage },
      { path: "lab", Component: LabHome },
      { path: "lab/:experimentId", Component: ExperimentPage },
      { path: "*", Component: NotFound },
    ],
  },
]);
