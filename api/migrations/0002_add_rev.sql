-- Número de revisão do estado: sobe 1 a cada gravação.
-- O app envia a revisão que conhece; se não for a atual, o Worker recusa (409).
ALTER TABLE app_state ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
