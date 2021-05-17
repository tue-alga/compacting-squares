This is an implementation of our algorithm Gather&Compact for modular robot reconfiguration. This implementation contains an interactive web-based visualizer, which allows for drawing instances and running the Gather&Compact algorithm on them. The visualizer can be accessed directly [here](https://alga.win.tue.nl/software/compacting-squares/visualizer). There is also a batch tool for running experiments.

For more information we refer to our paper

> Irina Kostitsyna, Irene Parada, Willem Sonke, Bettina Speckmann, and Jules Wulms, *Compacting Squares* (to appear)


## Visualizer

The visualizer is contained in `/visualizer`. It uses webpack to bundle the JavaScript code and its dependencies into a bundle.

First install the dependencies:

```sh
cd src
npm install
```

Build the tool (output appears in the `dist` folder):

```sh
npm run build
```

To manually start a webserver (open `http://localhost:8000` in a browser to see the result):

```sh
cd dist
python3 -m http.server 8000
```

Alternatively, run webpack's development server to automatically serve the application and rebuild and reload it on code changes:

```sh
npm run start
```

Note: the visualizer is a development tool and not a finished product; some known bugs are present. In particular, the reset button may not work properly, and we do not handle light configurations like described in Appendix A, so instances with few squares may misbehave.


## Batch tool

The batch tool is contained in `/batch`. This can be used to run experiments from the command line; in particular it can reproduce all of the experiments from our paper.

To build:

```sh
cd src
npm install
npm run build
```

To run:

```sh
# runs Gather&Compact on a single instance, produces output on the terminal
node dist/cli.js <instance>

# runs Gather&Compact on multiple instances, gives summarized output
node dist/cli-batch.js <instance_1> <instance_2> ...

# runs Gather&Compact on a single instance, produces Ipe figures in directory ipe
node dist/cli-ipe.js <instance>

# runs MSDP on a single instance, produces output on the terminal
node dist/cli-dp.js <instance>

# runs MSDP on multiple instances, gives summarized output
node dist/cli-dp-batch.js <instance_1> <instance_2> ...

# runs MSDP on a single instance, produces Ipe figures in directory ipe
node dist/cli-dp-ipe.js <instance>
```
Note that we tested these scripts on Linux only.

For some of the larger testcases (80x80 and 100x100), Node may run out of stack space due to deep recursion. To avoid this, one can increase the allocated stack size, for example on Linux systems:

```
/bin/bash -c "ulimit -s unlimited; exec node --stack-size=1000000 dist/cli.js <instance>"
```


## Instances

The directory `/test-instances` contains the test instances used for the experiments in our paper, and the spiral used in Figure 3. All instances are in JSON format, which can be read by our tool.

The directory `/generating-instances` contains the code used for generating the test instances. This is a Jupyter notebook using Sage.


## License

Our implementation is freely available under GPL v3.

Note: `batch/dist/dp.js` contains the [implementation](https://dccg.upc.edu/people/vera/TFM-TFG/Flooding/) of MSDP by Moreno and Sacristán (slightly adapted). To our knowledge this was not released by the authors under a free license.
