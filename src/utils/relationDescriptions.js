// src/utils/relationDescriptions.js
const relationDescriptions = {
  response: "A response relation means that whenever the source occurs, the target must eventually follow.",
  precedence: "A precedence relation means the target can only occur if the source has occurred before.",
  succession: "A succession relation means the source must be followed by the target, and the target can only occur if the source has occurred before.",
  coexistence: "A coexistence relation means that if one of the nodes occurs, the other must also occur at some point.",
  exclusion: "An exclusion relation means that the two nodes cannot both occur in the same trace.",
  // Add more relation types and their descriptions as needed
};

export default relationDescriptions;
