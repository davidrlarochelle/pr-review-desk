import { test } from "@e2e-dev/web";
import { reviewPullRequest } from "../flows";

test("review a pull request: running, then reported with its findings", reviewPullRequest);
