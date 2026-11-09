/**
 * DOM serializer export — node variant only (Nice One).
 */

export {
  setCurrentPageUrl,
  getCurrentPageUrl,
  getResolvedUrl,
  getSerializerVersionFromUrl,
} from "./serializerVersionFromUrl";

export type {
  SerializerConfig,
  InteractiveElementNode,
  DOMElementsJSON,
  SerializerOptions,
  InteractiveDomSerializerInterface,
} from "./serializers/interactiveDomSerializer_node";

export { default, default as serializerInstance } from "./serializers/interactiveDomSerializer_node";
