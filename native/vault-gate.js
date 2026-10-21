/* Startup/switch boundary for WFP.DB. Waiting for a locked vault is deliberately
   a pending promise, never a fabricated missing record or empty library.
   The UI owns unlock/retry and must call resume only after successful recovery. */
((g) => {
  'use strict';
  const METHODS = ['all','keys','get','put','del','vektorenWeg','putFile','getFile','persist'];
  class Gate {
    constructor(onError = () => {}) {
      this.onError = onError; this.active = 0; this.target = null;
      this.fault = false; this.generation = 0;
      this.waiters = []; this.drainers = []; this.blocked = true;
      this.db = Object.freeze(Object.fromEntries(METHODS.map(method => [method, (...args) => {
        // Preserve arguments at invocation, even if unlock takes several minutes.
        const copy = structuredClone(args);
        return this.run(method, copy);
      }])));
    }
    async run(method, args) {
      if (this.fault) throw new Error('VAULT_RECOVERY_REQUIRED');
      const generation = this.generation;
      while (this.blocked) await new Promise(resolve => this.waiters.push(resolve));
      if (generation !== this.generation && ['put','del','putFile','vektorenWeg'].includes(method))
        throw new Error('VAULT_RECOVERY_REQUIRED');
      const target = this.target; this.active++;
      try { return await target[method](...args); }
      catch (error) {
        this.blocked = true; this.fault = true; this.generation++;
        // A UI callback must not hide the underlying storage failure.
        try { this.onError(error); } catch { /* Keep the storage error. */ }
        throw error;
      } finally {
        if (--this.active === 0) for (const resolve of this.drainers.splice(0)) resolve();
      }
    }
    async pause() {
      this.blocked = true;
      if (this.active) await new Promise(resolve => this.drainers.push(resolve));
    }
    resume(target = this.target) {
      if (this.active || !target || METHODS.some(method => typeof target[method] !== 'function'))
        throw new Error('VAULT_GATE_NOT_READY');
      this.target = target; this.blocked = false; this.fault = false;
      for (const resolve of this.waiters.splice(0)) resolve();
    }
  }
  g.WFPVaultGate = Gate;
})(globalThis);
