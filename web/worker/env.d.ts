/** Bindings of the analytics Worker. The module (../analytics) only calls stub.fetch, so the namespace stays untyped. */
interface Env {
  VISIT_STATS: DurableObjectNamespace;
}
