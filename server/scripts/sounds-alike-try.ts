// Prints soundsAlike for name pairs, to tune the "same person, misheard" rule.
import { soundsAlike } from "../src/modules/live/names";
const pairs = [["Junaid","Jinay"],["Jinae","Jinay"],["John","Jinay"],["Jim","Jinay"],["Jamie","Jinay"],["Juan","Jinay"],["Jane","Jinay"],["Sean","Sam"],["Simon","Sam"],["Sara","Sam"],["Ryan","Ron"],["Lena","Mati"],["Nina","Nonit"],["Anand","Nonit"]];
for (const [a,b] of pairs) console.log(a, b, soundsAlike(a,b));
