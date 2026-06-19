function mapFromStoredJump(jump) {
  if (jump instanceof Map) return new Map(jump);
  if (Array.isArray(jump)) return new Map(jump);
  return new Map();
}

function createEngineContext(context = {}) {
  return {
    whitecastle: context.whitecastle !== false,
    blackcastle: context.blackcastle !== false,
    jump: mapFromStoredJump(context.jump),
  };
}

function getEngineContext(moveData = {}) {
  if (!moveData.context) {
    moveData.context = createEngineContext();
  }

  if (!(moveData.context.jump instanceof Map)) {
    moveData.context.jump = mapFromStoredJump(moveData.context.jump);
  }

  return moveData.context;
}

function serializeEngineContext(context = {}) {
  const normalized = createEngineContext(context);

  return {
    whitecastle: normalized.whitecastle,
    blackcastle: normalized.blackcastle,
    jump: Array.from(normalized.jump.entries()),
  };
}

module.exports = {
  createEngineContext,
  getEngineContext,
  serializeEngineContext,
};
